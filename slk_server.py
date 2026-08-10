import hashlib
import io
import os
import tempfile

import numpy as np
import pilk
import soundfile as sf
from flask import Flask, jsonify, request, send_file
from scipy.signal import resample_poly

QQ_RATE = 16000
MAX_SIZE = 30 * 1024 * 1024
RATES = (8000, 12000, 16000, 24000)
OK_SLK = {".slk", ".silk", ".amr", ".aud"}
OK_AUDIO = {".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_SIZE


@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    resp.headers["Access-Control-Expose-Headers"] = (
        "Content-Disposition, X-Out-Sha256, X-Out-Seconds"
    )
    return resp


@app.route("/ping")
def ping():
    return jsonify(ok=True)


def base_name(name):
    i = name.rfind(".")
    return name[:i] if i > 0 else name


def ext_of(name):
    return os.path.splitext(name)[1].lower()


def count_frames(data):
    pos = 10 if data[0] == 2 else 9
    n = 0
    while pos + 2 <= len(data):
        size = int.from_bytes(data[pos : pos + 2], "little")
        if size == 0 or pos + 2 + size > len(data):
            break
        n += 1
        pos += 2 + size
    return n


def detect_template(data):
    """以模板 slk 为基准, 探测其内部采样率 (8k/12k/16k/24k 中最接近者), 返回 (rate, frames)"""
    fd, tmp = tempfile.mkstemp(suffix=".slk")
    os.close(fd)
    try:
        with open(tmp, "wb") as fh:
            fh.write(data)
        probe = tmp + ".probe.pcm"
        try:
            pilk.decode(tmp, probe, pcm_rate=24000)
            pcm = np.fromfile(probe, dtype="<i2")
        except TypeError:
            pilk.decode(tmp, probe)
            pcm = np.fromfile(probe, dtype="<i2")
        best, best_diff = None, None
        for rate in RATES:
            if rate == 24000:
                rp = pcm.astype("f8")
            else:
                rp = resample_poly(pcm.astype("f8"), rate, 24000)
            rp.astype("<i2").tofile(probe)
            out = tmp + ".probe.slk"
            try:
                pilk.encode(probe, out, pcm_rate=rate, tencent=True, complexity=2)
                sz = os.path.getsize(out)
            finally:
                if os.path.exists(out):
                    os.remove(out)
            diff = abs(sz - len(data))
            if best is None or diff < best_diff:
                best, best_diff = rate, diff
        return best, count_frames(data)
    finally:
        for p in (tmp, tmp + ".probe.pcm"):
            if os.path.exists(p):
                os.remove(p)


def slk_to_mp3_bytes(data):
    fd, tmp = tempfile.mkstemp(suffix=".slk")
    os.close(fd)
    pcm_path = tmp + ".pcm"
    try:
        with open(tmp, "wb") as fh:
            fh.write(data)
        try:
            pilk.decode(tmp, pcm_path, pcm_rate=QQ_RATE)
        except TypeError:
            pilk.decode(tmp, pcm_path)
        pcm = np.fromfile(pcm_path, dtype="<i2")
        import lameenc

        enc = lameenc.Encoder()
        enc.set_bit_rate(64)
        enc.set_in_sample_rate(QQ_RATE)
        enc.set_channels(1)
        enc.set_quality(2)
        chunks = []
        view = memoryview(pcm.tobytes())
        step = QQ_RATE // 10
        for i in range(0, len(view), step):
            chunks.append(enc.encode(bytes(view[i : i + step])))
        chunks.append(enc.flush())
        return b"".join(chunks), len(pcm) / QQ_RATE
    finally:
        for p in (tmp, pcm_path):
            if os.path.exists(p):
                os.remove(p)


def mp3_to_slk_bytes(data, pcm_rate, target_frames):
    raw, sr = sf.read(io.BytesIO(data), dtype="float64", always_2d=True)
    mono = raw.mean(axis=1)
    if sr != pcm_rate:
        mono = resample_poly(mono, pcm_rate, sr)
    pcm = (np.clip(mono, -1.0, 1.0) * 32767).astype("<i2")
    if target_frames:
        need = target_frames * pcm_rate // 50
        if len(pcm) > need:
            pcm = pcm[:need]
        elif len(pcm) < need:
            pcm = np.pad(pcm, (0, need - len(pcm)))
    fd, pcm_path = tempfile.mkstemp(suffix=".pcm")
    os.close(fd)
    out_path = pcm_path + ".slk"
    try:
        pcm.tofile(pcm_path)
        pilk.encode(pcm_path, out_path, pcm_rate=pcm_rate, tencent=True, complexity=2)
        with open(out_path, "rb") as fh:
            out = fh.read()
        return out, count_frames(out) * 0.02
    finally:
        for p in (pcm_path, out_path):
            if os.path.exists(p):
                os.remove(p)


@app.route("/convert", methods=["POST"])
def convert():
    mode = request.form.get("mode", "").strip()
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify(error="缺少文件"), 400
    if mode not in ("slk2mp3", "mp32slk"):
        return jsonify(error="未知模式: %s" % mode), 400
    try:
        if mode == "slk2mp3":
            if ext_of(f.filename) not in OK_SLK:
                return jsonify(error="不支持的文件类型: %s" % f.filename), 400
            out, seconds = slk_to_mp3_bytes(f.read())
            name = base_name(f.filename) + ".mp3"
        else:
            if ext_of(f.filename) not in OK_AUDIO:
                return jsonify(error="不支持的文件类型: %s" % f.filename), 400
            rate, frames = QQ_RATE, None
            tpl = request.files.get("tpl")
            tpl_name = f.filename
            if tpl and tpl.filename:
                tpl_name = tpl.filename
                rate, frames = detect_template(tpl.read())
            out, seconds = mp3_to_slk_bytes(f.read(), rate, frames)
            name = base_name(tpl_name) + ".slk"
    except Exception as e:
        return jsonify(error="转换失败: %s" % e), 500

    digest = hashlib.sha256(out).hexdigest()
    resp = send_file(
        io.BytesIO(out),
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=name,
    )
    resp.headers["X-Out-Sha256"] = digest
    resp.headers["X-Out-Seconds"] = "%.3f" % seconds
    return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
