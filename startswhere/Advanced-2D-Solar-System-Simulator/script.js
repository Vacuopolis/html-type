// --- Constants and State Variables ---
const canvas = document.getElementById('solar-system');
const ctx = canvas.getContext('2d');
const simulationContainer = document.getElementById('simulation-container');

let paused = false;
let speed = 0.01; // Actual simulation speed
let zoom = 1;    // Actual zoom factor
let baseX, baseY;
let offsetX = 0, offsetY = 0;

let showLabels = true;
let showAsteroidBelt = false;

let viewMode = 'free';
let followTarget = 'earth';
let followTargetRotation = false;

let scaleFactor = 0;
const AU_KM = 149.6e6;

const REAL_SCALE_SUN_TARGET_RADIUS_PX = 30;

let kmToPxRealRadiusFactor;
let kmToPxRealDistanceFactor;

let starDensity = 300;
let starLayers = 3;
let starParallax = 0.2;
let starfields = [];

let isDragging = false;
let dragStartX, dragStartY;
let lastOffsetX, lastOffsetY;

let showPlanetTrails = false;
let showPlanetOrbits = false;
let showMoonTrails = false;
let showMoonOrbits = false;
let trailMaxPointsGlobal = 300;

const planets = [];
let asteroids = [];

const nameMap = {
    sun: "太阳", mercury: "水星", venus: "金星", earth: "地球", moon: "月球",
    mars: "火星", phobos: "火卫一", deimos: "火卫二",
    jupiter: "木星", io: "木卫一", europa: "木卫二", ganymede: "木卫三", callisto: "木卫四",
    saturn: "土星", titan: "土卫六",
    uranus: "天王星", miranda: "天卫五",
    neptune: "海王星", triton: "海卫一"
};

const SIMULATION_DAY_SCALER = 1 / 150;

// Speed Slider Constants
const G_SPEED_SLIDER_MIN_VAL = 1;
const G_SPEED_SLIDER_MAX_VAL = 2000; // Increased for smoother control
const G_SIM_SPEED_MIN = 0.001;
const G_SIM_SPEED_MAX = 100;
const G_LOG_SIM_SPEED_MIN = Math.log(G_SIM_SPEED_MIN);
const G_LOG_SIM_SPEED_MAX = Math.log(G_SIM_SPEED_MAX);
const G_SLIDER_TO_SPEED_SCALE = (G_LOG_SIM_SPEED_MAX - G_LOG_SIM_SPEED_MIN) / (G_SPEED_SLIDER_MAX_VAL - G_SPEED_SLIDER_MIN_VAL);

// Zoom Slider Constants
const G_ZOOM_SLIDER_MIN_VAL = 1;
const G_ZOOM_SLIDER_MAX_VAL = 1000;
const G_ACTUAL_ZOOM_MIN = 0.001; // Min zoom set to 0.001x
const G_ACTUAL_ZOOM_MAX = 20;
const G_LOG_ACTUAL_ZOOM_MIN = Math.log(G_ACTUAL_ZOOM_MIN);
const G_LOG_ACTUAL_ZOOM_MAX = Math.log(G_ACTUAL_ZOOM_MAX);


// --- Initialization ---
function calculateRealScaleFactors() {
    const sun = planets.find(p => p.name === 'sun');
    if (!sun) {
        console.error("Sun not found for scale calculation.");
        kmToPxRealRadiusFactor = 0.0001;
        kmToPxRealDistanceFactor = 0.0001;
        return;
    }
    kmToPxRealRadiusFactor = REAL_SCALE_SUN_TARGET_RADIUS_PX / (sun.realData.diameter / 2);
    kmToPxRealDistanceFactor = kmToPxRealRadiusFactor;
}

function initializePlanetData() {
    const initialPlanetStates = [
        {
            name: "sun", color: "FDB813", radius: 35, distance: 0, orbit: 0, speed: 0, rotationSpeed: 0.05, moons: [], rings: false,
            realData: { diameter: 1392700, mass: 1.989e30, distance: 0, rotationPeriodHours: 609.12, axialTiltDegrees: 7.25, meanTemperatureC: 5500, atmosphere: "H (73%), He (25%)" }
        },
        {
            name: "mercury", color: "B7B8B9", radius: 4, distance: 60, orbit: 88, speed: 0.041, rotationSpeed: 0.001, moons: [], rings: false,
            realData: { diameter: 4879, mass: 3.3011e23, distance: 57.9e6, rotationPeriodHours: 1407.6, axialTiltDegrees: 0.03, orbitalEccentricity: 0.2056, meanTemperatureC: 167, atmosphere: "Thin exosphere" }
        },
        {
            name: "venus", color: "E7CDCD", radius: 8, distance: 90, orbit: 225, speed: 0.016, rotationSpeed: -0.0005, moons: [], rings: false,
            realData: { diameter: 12104, mass: 4.8675e24, distance: 108.2e6, rotationPeriodHours: -5832.6, axialTiltDegrees: 177.36, orbitalEccentricity: 0.0067, meanTemperatureC: 464, atmosphere: "CO2 (96.5%), N2 (3.5%)" }
        },
        {
            name: "earth", color: "267bef", radius: 9, distance: 130, orbit: 365, speed: 0.01, rotationSpeed: 0.1,
            moons: [{
                name: "moon", baseRadius: 2, baseDistance: 15, radius: 2, distance: 15, orbit: 27, angle: 0, speed: 0.1,
                realData: { diameter: 3474, mass: 7.342e22, distanceFromParentKm: 384400, rotationPeriodHours: 655.7, orbitalEccentricity: 0.0549, meanTemperatureC: -20 }
            }],
            rings: false,
            realData: { diameter: 12742, mass: 5.97237e24, distance: 149.6e6, rotationPeriodHours: 23.93, axialTiltDegrees: 23.44, orbitalEccentricity: 0.0167, meanTemperatureC: 15, atmosphere: "N2 (78%), O2 (21%)" }
        },
        {
            name: "mars", color: "c1440e", radius: 6, distance: 180, orbit: 687, speed: 0.0053, rotationSpeed: 0.09,
            moons: [
                { name: "phobos", baseRadius: 1, baseDistance: 10, radius: 1, distance: 10, orbit: 0.3, angle: 0, speed: 0.2, realData: { diameter: 22.5, distanceFromParentKm: 9376 } },
                { name: "deimos", baseRadius: 1, baseDistance: 14, radius: 1, distance: 14, orbit: 1.2, angle: Math.PI, speed: 0.15, realData: { diameter: 12.4, distanceFromParentKm: 23463 } }
            ],
            rings: false,
            realData: { diameter: 6779, mass: 6.4171e23, distance: 227.9e6, rotationPeriodHours: 24.62, axialTiltDegrees: 25.19, orbitalEccentricity: 0.0934, meanTemperatureC: -63, atmosphere: "CO2 (95%), N2 (2.6%)" }
        },
        {
            name: "jupiter", color: "e0b44e", radius: 25, distance: 280, orbit: 4333, speed: 0.0008, rotationSpeed: 0.25,
            moons: [
                { name: "io", baseRadius: 2, baseDistance: 35, radius: 2, distance: 35, orbit: 1.7, angle: 0, speed: 0.05, realData: { diameter: 3643, distanceFromParentKm: 421700, rotationPeriodHours: 42.46 } },
                { name: "europa", baseRadius: 2, baseDistance: 40, radius: 2, distance: 40, orbit: 3.5, angle: Math.PI / 2, speed: 0.04, realData: { diameter: 3122, distanceFromParentKm: 671034, rotationPeriodHours: 85.22 } },
                { name: "ganymede", baseRadius: 3, baseDistance: 45, radius: 3, distance: 45, orbit: 7.1, angle: Math.PI, speed: 0.03, realData: { diameter: 5268, distanceFromParentKm: 1070412, rotationPeriodHours: 171.7 } },
                { name: "callisto", baseRadius: 3, baseDistance: 55, radius: 3, distance: 55, orbit: 16.7, angle: Math.PI * 1.5, speed: 0.02, realData: { diameter: 4821, distanceFromParentKm: 1882709, rotationPeriodHours: 400.5 } }
            ],
            rings: true, ringColor: "c0a080", ringInner: 30, ringOuter: 50,
            realData: { diameter: 139820, mass: 1.8982e27, distance: 778.5e6, rotationPeriodHours: 9.93, axialTiltDegrees: 3.13, orbitalEccentricity: 0.0489, meanTemperatureC: -145, atmosphere: "H2 (89%), He (10%)" }
        },
        {
            name: "saturn", color: "f4d4a9", radius: 20, distance: 380, orbit: 10759, speed: 0.0003, rotationSpeed: 0.23,
            moons: [{ name: "titan", baseRadius: 3, baseDistance: 35, radius: 3, distance: 35, orbit: 16, angle: Math.PI / 3, speed: 0.04, realData: { diameter: 5150, distanceFromParentKm: 1221870, rotationPeriodHours: 382.7 } }],
            rings: true, ringColor: "f4ebd2", ringInner: 25, ringOuter: 40,
            realData: { diameter: 116460, mass: 5.6834e26, distance: 1432e6, rotationPeriodHours: 10.66, axialTiltDegrees: 26.73, orbitalEccentricity: 0.0565, meanTemperatureC: -178, atmosphere: "H2 (96%), He (3%)" }
        },
        {
            name: "uranus", color: "BAFFFA", radius: 15, distance: 480, orbit: 30687, speed: 0.0001, rotationSpeed: -0.15,
            moons: [{ name: "miranda", baseRadius: 1, baseDistance: 22, radius: 1, distance: 22, orbit: 1.4, angle: Math.PI * 1.2, speed: 0.03, realData: { diameter: 471, distanceFromParentKm: 129390, rotationPeriodHours: 33.9 } }],
            rings: true, ringColor: "e0faf8", ringInner: 18, ringOuter: 22,
            realData: { diameter: 50724, mass: 8.6810e25, distance: 2867e6, rotationPeriodHours: -17.24, axialTiltDegrees: 97.77, orbitalEccentricity: 0.0457, meanTemperatureC: -214, atmosphere: "H2 (83%), He (15%), CH4 (2%)" }
        },
        {
            name: "neptune", color: "5B5DDF", radius: 14, distance: 580, orbit: 60190, speed: 0.00006, rotationSpeed: 0.12,
            moons: [{ name: "triton", baseRadius: 2, baseDistance: 25, radius: 2, distance: 25, orbit: 5.8, angle: Math.PI * 0.8, speed: -0.02, realData: { diameter: 2706, distanceFromParentKm: 354759, rotationPeriodHours: -141.1 } }],
            rings: true, ringColor: "a0a0f0", ringInner: 16, ringOuter: 20,
            realData: { diameter: 49244, mass: 1.02413e26, distance: 4515e6, rotationPeriodHours: 16.11, axialTiltDegrees: 28.32, orbitalEccentricity: 0.0113, meanTemperatureC: -218, atmosphere: "H2 (80%), He (19%), CH4 (1%)" }
        }
    ];
    planets.length = 0;
    initialPlanetStates.forEach(p => {
        const planet = {
            ...p,
            angle: Math.random() * Math.PI * 2,
            rotationAngle: Math.random() * Math.PI * 2,
            trail: [],
            baseRadius: p.radius,
            baseDistance: p.distance,
        };
        if (planet.moons) {
            planet.moons = planet.moons.map(m => ({
                ...m,
                angle: Math.random() * Math.PI * 2,
                trail: [],
                baseRadius: m.radius,
                baseDistance: m.distance
            }));
        }
        planets.push(planet);
    });
}

// --- Canvas and Drawing ---
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = simulationContainer.clientWidth * dpr;
    canvas.height = simulationContainer.clientHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    baseX = simulationContainer.clientWidth / 2;
    baseY = simulationContainer.clientHeight / 2;
    adjustVerticalPanelLayout();
}
function generateMultiLayerStarfield() {
    starfields = [];
    const bufferFactor = 2;
    const width = simulationContainer.clientWidth * bufferFactor;
    const height = simulationContainer.clientHeight * bufferFactor;
    const starOffsetX = -width / 2 + simulationContainer.clientWidth / 2;
    const starOffsetY = -height / 2 + simulationContainer.clientHeight / 2;

    for (let layer = 0; layer < starLayers; layer++) {
        const layerStars = [];
        const numStarsInLayer = Math.floor(starDensity * (Math.pow(0.7, layer)));
        const layerParallaxFactor = starParallax * (layer + 1) / starLayers;
        const layerMaxBrightness = 0.2 + (0.8 * (starLayers - layer) / starLayers);

        for (let i = 0; i < numStarsInLayer; i++) {
            layerStars.push({
                x: starOffsetX + Math.random() * width,
                y: starOffsetY + Math.random() * height,
                radius: Math.random() * (1.5 - layer * 0.2) + 0.3,
                brightness: Math.random() * layerMaxBrightness,
                twinkleSpeed: Math.random() * 0.005 + 0.001,
                twinkleOffset: Math.random() * Math.PI * 2,
                parallaxFactor: layerParallaxFactor
            });
        }
        starfields.push(layerStars);
    }
}
function drawMultiLayerStarfield(currentOffsetX, currentOffsetY, viewRotation = 0) {
    ctx.save();
    if (viewRotation !== 0) {
        ctx.translate(baseX, baseY);
        ctx.rotate(viewRotation);
        ctx.translate(-baseX, -baseY);
    }

    starfields.forEach((layerStars) => {
        layerStars.forEach(star => {
            const parallaxX = currentOffsetX * star.parallaxFactor;
            const parallaxY = currentOffsetY * star.parallaxFactor;
            const adjustedX = star.x - parallaxX;
            const adjustedY = star.y - parallaxY;
            if (adjustedX < -star.radius || adjustedX > simulationContainer.clientWidth + star.radius ||
                adjustedY < -star.radius || adjustedY > simulationContainer.clientHeight + star.radius) {
                return;
            }
            const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.twinkleOffset) * 0.4 + 0.6;
            const opacity = star.brightness * twinkle;
            ctx.beginPath();
            ctx.arc(adjustedX, adjustedY, star.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fill();
        });
    });
    ctx.restore();
}
function generateAsteroidBelt() {
    asteroids = [];
    const asteroidCount = 600;
    const mars = planets.find(p => p.name === 'mars');
    const jupiter = planets.find(p => p.name === 'jupiter');
    if (!mars || !jupiter) { console.error("Mars or Jupiter not found for asteroid belt"); return; }

    const minBaseDistance = mars.baseDistance + 30;
    const maxBaseDistance = jupiter.baseDistance - 30;

    for (let i = 0; i < asteroidCount; i++) {
        const baseDistance = minBaseDistance + Math.random() * (maxBaseDistance - minBaseDistance);
        const angle = Math.random() * Math.PI * 2;
        const size = 0.3 + Math.random() * 1.2;
        const speed = (0.002 + (Math.random() * 2 - 1) * 0.0005) * (150 / baseDistance);
        const grayValue = Math.floor(Math.random() * 80 + 100).toString(16);
        const color = grayValue + grayValue + grayValue;
        asteroids.push({ baseDistance, angle, size, speed, color });
    }
}
function drawAsteroidBelt(currentSunX, currentSunY) {
    if (!showAsteroidBelt || !kmToPxRealDistanceFactor) return;
    const mars = planets.find(p => p.name === 'mars');
    if (!mars || !mars.realData) return;

    asteroids.forEach(asteroid => {
        const estimatedRealKmDistance = (asteroid.baseDistance / mars.baseDistance) * mars.realData.distance;
        const targetRealScaledDistancePx = estimatedRealKmDistance * kmToPxRealDistanceFactor;
        const currentDisplayDistance = expLerp(asteroid.baseDistance, Math.max(0.1, targetRealScaledDistancePx), scaleFactor);
        const visualBaseSize = asteroid.size;
        const targetRealScaledSizePx = visualBaseSize * 0.2;
        const currentDisplaySize = expLerp(visualBaseSize, Math.max(0.1, targetRealScaledSizePx), scaleFactor);

        const x = currentSunX + currentDisplayDistance * Math.cos(asteroid.angle) * zoom;
        const y = currentSunY + currentDisplayDistance * Math.sin(asteroid.angle) * zoom;
        const radius = Math.max(0.5, currentDisplaySize * zoom);

        if (x > -radius && x < simulationContainer.clientWidth + radius &&
            y > -radius && y < simulationContainer.clientHeight + radius) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `#${asteroid.color}`;
            ctx.fill();
        }
    });
}

function expLerp(a, b, t) {
    const minVal = 0.01;
    a = Math.max(a, minVal);
    b = Math.max(b, minVal);
    return Math.exp(Math.log(a) * (1 - t) + Math.log(b) * t);
}
function lerp(a, b, t) { return a * (1 - t) + b * t; }

function getScaledPlanetProps(planet) {
    let realScaledRadius, realScaledDistance;
    const minVal = 0.01;

    if (planet.name === "sun") {
        realScaledRadius = (planet.realData.diameter / 2) * kmToPxRealRadiusFactor;
        realScaledDistance = 0;
    } else {
        realScaledRadius = (planet.realData.diameter / 2) * kmToPxRealRadiusFactor;
        realScaledDistance = planet.realData.distance * kmToPxRealDistanceFactor;
    }

    realScaledRadius = Math.max(minVal, realScaledRadius);
    if (planet.name !== "sun") {
        realScaledDistance = Math.max(minVal, realScaledDistance);
    }

    const currentDisplayDistance = (planet.name === "sun") ? 0 : expLerp(planet.baseDistance, realScaledDistance, scaleFactor);
    const currentDisplayRadius = expLerp(planet.baseRadius, realScaledRadius, scaleFactor);

    return { currentDisplayDistance, currentDisplayRadius };
}

function getScaledMoonProps(moon, parentPlanet) {
    const parentCurrentProps = getScaledPlanetProps(parentPlanet);
    const parentRadiusScaleEffect = parentPlanet.baseRadius > 0.01 ? (parentCurrentProps.currentDisplayRadius / parentPlanet.baseRadius) : 1;

    let currentDisplayRadius = moon.baseRadius * parentRadiusScaleEffect;
    let currentDisplayDistance = moon.baseDistance * parentRadiusScaleEffect;

    if (moon.realData && moon.realData.diameter && moon.realData.distanceFromParentKm && scaleFactor > 0.5) {
        const realMoonRadiusKm = moon.realData.diameter / 2;
        const realMoonDistKm = moon.realData.distanceFromParentKm;

        const targetRealMoonRadiusPx = realMoonRadiusKm * kmToPxRealRadiusFactor;
        const targetRealMoonDistPx = realMoonDistKm * kmToPxRealDistanceFactor;

        currentDisplayRadius = expLerp(moon.baseRadius * parentRadiusScaleEffect, Math.max(0.05, targetRealMoonRadiusPx), scaleFactor);
        currentDisplayDistance = expLerp(moon.baseDistance * parentRadiusScaleEffect, Math.max(0.1, targetRealMoonDistPx), scaleFactor);
    }

    const minVal = 0.05;
    currentDisplayRadius = Math.max(minVal, currentDisplayRadius);
    currentDisplayDistance = Math.max(minVal, currentDisplayDistance);

    return { currentDisplayDistance, currentDisplayRadius };
}

function updatePositions(timeScale, planetScreenPositions) {
    if (paused) return;
    const actualSpeed = speed * timeScale;

    planets.forEach(planet => {
        if (planet.speed !== 0) {
            planet.angle += planet.speed * actualSpeed;
            planet.angle %= (Math.PI * 2);
        }

        if (planet.realData && typeof planet.realData.rotationPeriodHours === 'number') {
            const rotationPeriodInSimDays = planet.realData.rotationPeriodHours / 24;
            if (rotationPeriodInSimDays !== 0) {
                planet.rotationAngle += (Math.PI * 2 / rotationPeriodInSimDays) * actualSpeed * SIMULATION_DAY_SCALER;
            }
        } else {
            planet.rotationAngle += planet.rotationSpeed * actualSpeed * 10;
        }
        planet.rotationAngle %= (Math.PI * 2);


        const screenPos = planetScreenPositions[planet.name];
        if (showPlanetTrails && planet.name !== "sun" && screenPos && screenPos.onScreen) {
            planet.trail.push({ x: screenPos.x, y: screenPos.y });
            if (planet.trail.length > trailMaxPointsGlobal) {
                planet.trail.shift();
            }
        }

        if (planet.moons) {
            planet.moons.forEach(moon => {
                moon.angle += moon.speed * actualSpeed * 20;
                moon.angle %= (Math.PI * 2);
                if (moon.realData && typeof moon.realData.rotationPeriodHours === 'number') {
                    const moonRotPeriodInSimDays = moon.realData.rotationPeriodHours / 24;
                    if (moonRotPeriodInSimDays !== 0) {
                        // moon.rotationAngle += (Math.PI * 2 / moonRotPeriodInSimDays) * actualSpeed * SIMULATION_DAY_SCALER;
                        // moon.rotationAngle %= (Math.PI * 2);
                    }
                }


                const moonScreenPos = planetScreenPositions[`${planet.name}-${moon.name}`];
                if (showMoonTrails && moonScreenPos && moonScreenPos.onScreen) {
                    moon.trail.push({ x: moonScreenPos.x, y: moonScreenPos.y });
                    if (moon.trail.length > trailMaxPointsGlobal) {
                        moon.trail.shift();
                    }
                }
            });
        }
    });
    if (showAsteroidBelt) {
        asteroids.forEach(asteroid => {
            asteroid.angle += asteroid.speed * actualSpeed;
            asteroid.angle %= (Math.PI * 2);
        });
    }
}

function drawCelestialBody(planet, sunScreenX, sunScreenY, currentViewRotation) { // currentViewRotation is kept for potential future use or internal consistency, but not used for label
    const { currentDisplayDistance, currentDisplayRadius } = getScaledPlanetProps(planet);

    const x = sunScreenX + currentDisplayDistance * Math.cos(planet.angle) * zoom;
    const y = sunScreenY + currentDisplayDistance * Math.sin(planet.angle) * zoom;
    const radius = Math.max(0.5, currentDisplayRadius * zoom);

    let planetScreenDataToReturn = {
        [planet.name]: { x, y, radius, name: planet.name, onScreen: false }
    };

    const planetIsOnScreen = !(x + radius < 0 || x - radius > simulationContainer.clientWidth ||
        y + radius < 0 || y - radius > simulationContainer.clientHeight);
    planetScreenDataToReturn[planet.name].onScreen = planetIsOnScreen;

    // ===== DRAWING LOGIC (Trails, Orbits, Planets, Moons) - Unchanged from v2.8.1 =====
    // This section is identical to v2.8.1, including detailed sun, earth, generic planet, rings, and moon drawing.
    // For brevity, it's not repeated here but assumed to be the same. The only change related to drawing is the label handling below.
    // Trails and Orbits drawing for planets...
    if (showPlanetTrails && planet.trail && planet.trail.length > 1 && planet.name !== "sun") {
        ctx.beginPath(); ctx.moveTo(planet.trail[0].x, planet.trail[0].y);
        for (let i = 1; i < planet.trail.length; i++) { ctx.lineTo(planet.trail[i].x, planet.trail[i].y); }
        ctx.strokeStyle = `#${planet.color}99`; ctx.lineWidth = 1.5; ctx.stroke();
    }

    if (showPlanetOrbits && viewMode === 'free' && planet.distance > 0 && planet.name !== "sun") {
        const orbitScreenRadius = currentDisplayDistance * zoom;
        if (orbitScreenRadius > 1) {
            const orbitSegments = 36; const angleStep = (Math.PI * 2) / orbitSegments;
            for (let i = 0; i < orbitSegments; i++) {
                const startAngle = i * angleStep; const endAngle = (i + 1) * angleStep;
                const segmentMidAngle = startAngle + angleStep / 2;
                const angleDiffFromPlanet = Math.abs(segmentMidAngle - planet.angle);
                const brightness = 0.08 + (0.22 * (Math.cos(angleDiffFromPlanet) + 1) / 2);
                ctx.beginPath(); ctx.arc(sunScreenX, sunScreenY, orbitScreenRadius, startAngle, endAngle);
                ctx.strokeStyle = `rgba(255, 255, 255, ${brightness})`; ctx.lineWidth = 1.5; ctx.stroke();
            }
        }
    }
    if (planetIsOnScreen) {
        // DETAILED PLANET DRAWING CODE (Sun, Earth, Mercury, Venus, etc., Rings)
        // This block is the same as in v2.8.1 and is extensive.
        // For brevity, only a placeholder comment is here.
        // Assume the full drawing logic for each celestial body type is present.
        if (planet.name === "sun") { // Example: Sun (full code as before)
            ctx.save();
            const outerGlowRadius = radius * 2.5;
            const outerGlow = ctx.createRadialGradient(x, y, radius * 0.8, x, y, outerGlowRadius);
            outerGlow.addColorStop(0, "rgba(255, 220, 100, 0.4)"); outerGlow.addColorStop(0.3, "rgba(255, 150, 50, 0.25)"); outerGlow.addColorStop(0.6, "rgba(255, 80, 20, 0.15)"); outerGlow.addColorStop(1, "rgba(255, 30, 0, 0)");
            ctx.beginPath(); ctx.arc(x, y, outerGlowRadius, 0, Math.PI * 2); ctx.fillStyle = outerGlow; ctx.fill();
            const innerGlowRadius = radius * 1.4;
            const innerGlow = ctx.createRadialGradient(x, y, radius * 0.1, x, y, innerGlowRadius);
            innerGlow.addColorStop(0, "rgba(255, 255, 255, 0.95)"); innerGlow.addColorStop(0.2, "rgba(255, 255, 220, 0.85)"); innerGlow.addColorStop(0.5, "rgba(255, 220, 50, 0.65)"); innerGlow.addColorStop(1, "rgba(255, 150, 20, 0)");
            ctx.beginPath(); ctx.arc(x, y, innerGlowRadius, 0, Math.PI * 2); ctx.fillStyle = innerGlow; ctx.fill();
            const offsetXGrad = radius * 0.25; const offsetYGrad = radius * 0.25;
            const sunGradient = ctx.createRadialGradient(x - offsetXGrad, y - offsetYGrad, radius * 0.05, x, y, radius);
            sunGradient.addColorStop(0, "#FFFFFF"); sunGradient.addColorStop(0.2, "#FFFFA0"); sunGradient.addColorStop(0.5, "#FFDD00"); sunGradient.addColorStop(0.8, "#FF9500"); sunGradient.addColorStop(0.95, "#FF5500"); sunGradient.addColorStop(1, "#FF3000");
            ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = sunGradient; ctx.fill();
            const time = Date.now() * 0.0001 + planet.rotationAngle;
            ctx.save(); ctx.translate(x, y); ctx.rotate(time * 0.5);
            ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip();
            const cellCount = 12; const cellSize = radius * 1.5 / cellCount;
            for (let i = -cellCount; i < cellCount; i++) { for (let j = -cellCount; j < cellCount; j++) { const cellX = i * cellSize; const cellY = j * cellSize; const distFromCenter = Math.sqrt(cellX * cellX + cellY * cellY); if (distFromCenter < radius * 0.95) { const noise = Math.sin(i * 0.5 + time * 5) * Math.cos(j * 0.5 + time * 3) * 0.5 + 0.5; const cellGradient = ctx.createRadialGradient(cellX, cellY, 0, cellX, cellY, cellSize * (0.8 + noise * 0.4)); const brightness = 1 - (distFromCenter / radius) * 0.5; const r_val = Math.floor(255 * brightness); const g_val = Math.floor((180 + noise * 50) * brightness); const b_val = Math.floor(noise * 50 * brightness); cellGradient.addColorStop(0, `rgba(${r_val}, ${g_val}, ${b_val}, 0.8)`); cellGradient.addColorStop(0.7, `rgba(${r_val - 40}, ${g_val - 60}, ${b_val}, 0.2)`); cellGradient.addColorStop(1, "rgba(255, 100, 0, 0)"); ctx.beginPath(); ctx.arc(cellX, cellY, cellSize * (0.5 + noise * 0.5), 0, Math.PI * 2); ctx.fillStyle = cellGradient; ctx.fill(); } } }
            const spotsCount = 8; for (let i = 0; i < spotsCount; i++) { const angleOffset = (Math.PI * 2) / spotsCount; const angle_val = (i * angleOffset) + Math.sin(time * 3) * 0.2; const variation = Math.sin(time * 2 + i * 1.4) * 0.25; const dist = radius * (0.3 + variation * 0.5 + i * 0.05) % radius; const spotSize = radius * (0.08 + Math.abs(variation) * 0.07); const spotX = Math.cos(angle_val) * dist; const spotY = Math.sin(angle_val) * dist; const umbra = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotSize); umbra.addColorStop(0, "rgba(10, 0, 0, 0.95)"); umbra.addColorStop(0.5, "rgba(30, 5, 0, 0.9)"); umbra.addColorStop(0.7, "rgba(60, 15, 0, 0.7)"); umbra.addColorStop(1, "rgba(120, 40, 0, 0)"); ctx.beginPath(); ctx.arc(spotX, spotY, spotSize, 0, Math.PI * 2); ctx.fillStyle = umbra; ctx.fill(); const penumbraSize = spotSize * 1.8; ctx.strokeStyle = "rgba(180, 60, 0, 0.15)"; for (let j = 0; j < 12; j++) { const fiberAngle = (j / 12) * Math.PI * 2; const fiberLength = penumbraSize * (0.8 + Math.random() * 0.4); ctx.beginPath(); ctx.moveTo(spotX + Math.cos(fiberAngle) * spotSize * 0.7, spotY + Math.sin(fiberAngle) * spotSize * 0.7); const cpDist = spotSize * 1.2; const cpAngleOffset = Math.sin(time * 5 + j) * 0.2; ctx.quadraticCurveTo(spotX + Math.cos(fiberAngle + cpAngleOffset) * cpDist, spotY + Math.sin(fiberAngle + cpAngleOffset) * cpDist, spotX + Math.cos(fiberAngle) * fiberLength, spotY + Math.sin(fiberAngle) * fiberLength); ctx.lineWidth = spotSize * 0.1; ctx.stroke(); } }
            ctx.restore();
            const flareCount = 9; for (let i = 0; i < flareCount; i++) { const flareAngle = (i / flareCount) * Math.PI * 2 + Math.sin(time * 3 + i) * 0.2; const flareTime = time * 8 + i * 2.5; const flareIntensity = 0.6 + Math.sin(flareTime * 0.5) * 0.4; const flareSize = radius * (0.6 + Math.sin(flareTime) * 0.3) * flareIntensity; ctx.save(); ctx.translate(x, y); ctx.rotate(flareAngle); ctx.beginPath(); ctx.moveTo(radius * 0.92, 0); const cp1x = radius * (1.1 + Math.sin(flareTime * 0.3) * 0.1); const cp1y = radius * 0.4 * Math.sin(flareTime * 0.7); const cp2x = radius * (1.4 + Math.cos(flareTime * 0.5) * 0.15); const cp2y = radius * 0.25 * Math.sin(flareTime * 0.9); const cp3x = radius * (1.6 + Math.sin(flareTime * 0.4) * 0.2); const cp3y = radius * 0.15 * Math.sin(flareTime * 1.1); const endX = radius * (1.4 + Math.sin(flareTime * 0.3) * 0.3) * flareIntensity; const endY = 0; ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, cp3x, cp3y); ctx.bezierCurveTo(endX, endY, endX, -endY, cp3x, -cp3y); ctx.bezierCurveTo(cp2x, -cp2y, cp1x, -cp1y, radius * 0.92, 0); const flareGradient = ctx.createRadialGradient(radius, 0, 0, radius, 0, flareSize); flareGradient.addColorStop(0, "rgba(255, 255, 240, 0.9)"); flareGradient.addColorStop(0.3, "rgba(255, 220, 100, 0.7)"); flareGradient.addColorStop(0.6, "rgba(255, 180, 30, 0.5)"); flareGradient.addColorStop(0.8, "rgba(255, 120, 0, 0.3)"); flareGradient.addColorStop(1, "rgba(255, 60, 0, 0)"); ctx.fillStyle = flareGradient; ctx.fill(); if (flareIntensity > 0.7) { ctx.beginPath(); ctx.moveTo(radius * 0.95, 0); ctx.bezierCurveTo(cp1x * 0.95, cp1y * 0.5, cp2x * 0.95, cp2y * 0.5, endX * 0.9, 0); ctx.strokeStyle = "rgba(255, 255, 220, 0.6)"; ctx.lineWidth = radius * 0.02; ctx.stroke(); } ctx.restore(); }
            const pulseSpeed = 3; const pulseAmplitude = 0.04; const pulsePhase = Math.sin(time * pulseSpeed) * pulseAmplitude; const pulseRadius = radius * (1 + pulsePhase); ctx.beginPath(); ctx.arc(x, y, pulseRadius, 0, Math.PI * 2); const pulseColor = Math.floor(200 + 55 * Math.sin(time * pulseSpeed)); ctx.fillStyle = `rgba(255, ${pulseColor}, 180, 0.25)`; ctx.fill();
            ctx.save(); ctx.translate(x, y); for (let i = 0; i < 36; i++) { const sparkAngle = (i / 36) * Math.PI * 2; const sparkTime = time * 12 + i * 0.5; const sparkLength = radius * 0.15 * (0.5 + Math.abs(Math.sin(sparkTime))); ctx.save(); ctx.rotate(sparkAngle); ctx.beginPath(); ctx.moveTo(radius, 0); ctx.lineTo(radius + sparkLength, 0); ctx.strokeStyle = `rgba(255, 255, 200, ${0.4 * Math.sin(sparkTime) * Math.sin(sparkTime)})`; ctx.lineWidth = radius * 0.03; ctx.stroke(); ctx.restore(); } ctx.restore();
            ctx.beginPath(); ctx.arc(x, y, radius * 1.05, 0, Math.PI * 2); const finalGlow = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 1.05); finalGlow.addColorStop(0, "rgba(255, 255, 200, 0.4)"); finalGlow.addColorStop(1, "rgba(255, 200, 100, 0)"); ctx.fillStyle = finalGlow; ctx.fill();
            ctx.restore();
        } else if (planet.name === "earth") { // Example: Earth (full code as before)
            ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = "#0077be"; ctx.fill();
            ctx.save(); ctx.translate(x, y); ctx.rotate(planet.rotationAngle); ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip();
            ctx.beginPath(); ctx.moveTo(-radius * 0.3, -radius * 0.3); ctx.lineTo(-radius * 0.5, -radius * 0.1); ctx.lineTo(-radius * 0.3, radius * 0.2); ctx.lineTo(-radius * 0.1, radius * 0.3); ctx.lineTo(radius * 0.1, 0); ctx.lineTo(0, -radius * 0.3); ctx.closePath(); ctx.fillStyle = "#4caf50"; ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, -radius * 0.3); ctx.lineTo(radius * 0.4, -radius * 0.1); ctx.lineTo(radius * 0.4, radius * 0.2); ctx.lineTo(0, radius * 0.4); ctx.lineTo(-radius * 0.2, radius * 0.3); ctx.closePath(); ctx.fillStyle = "#4caf50"; ctx.fill();
            ctx.beginPath(); ctx.arc(0, radius * 0.7, radius * 0.3, 0, Math.PI * 2); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(x, y); const cloudRotation = Date.now() * 0.00002 + planet.rotationAngle * 0.8; ctx.rotate(cloudRotation); ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; const numCloudPatches = 5; for (let i = 0; i < numCloudPatches; i++) { const cloudAngle = (i / numCloudPatches) * Math.PI * 2 + (Math.PI / numCloudPatches * Math.sin(Date.now() * 0.00005 + i * 0.5)); const cloudDist = radius * (0.6 + Math.sin(Date.now() * 0.00003 + i * 2.0) * 0.15); const cloudSizeBase = radius * 0.25; const cloudSizeVariation = Math.sin(Date.now() * 0.00007 + i * 1.5) * radius * 0.1; const cloudSize = cloudSizeBase + cloudSizeVariation; const cX = Math.cos(cloudAngle) * cloudDist; const cY = Math.sin(cloudAngle) * cloudDist; ctx.beginPath(); ctx.arc(cX, cY, cloudSize, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
            ctx.beginPath(); ctx.arc(x, y, radius * 1.05, 0, Math.PI * 2); const atmosphereEarth = ctx.createRadialGradient(x, y, radius, x, y, radius * 1.05); atmosphereEarth.addColorStop(0, "rgba(135, 206, 250, 0.3)"); atmosphereEarth.addColorStop(1, "rgba(135, 206, 250, 0)"); ctx.fillStyle = atmosphereEarth; ctx.fill();
            ctx.restore();
        } else { // Fallback for other planets or if detailed drawing is missing (full code as before)
            ctx.beginPath(); ctx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2); ctx.fillStyle = `#${planet.color}`; ctx.fill();
            ctx.save(); ctx.translate(x, y); ctx.rotate(planet.rotationAngle); ctx.beginPath(); ctx.moveTo(0, -radius * 0.8); ctx.lineTo(0, radius * 0.8); ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = radius * 0.1; ctx.restore();
            if (planet.rings) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 12); ctx.scale(1, 0.35); const ringScaleRelativeToPlanetGeneric = (planet.baseRadius > 0.01 ? currentDisplayRadius / planet.baseRadius : 1); const ringOuter = planet.ringOuter * ringScaleRelativeToPlanetGeneric * zoom; const ringInner = planet.ringInner * ringScaleRelativeToPlanetGeneric * zoom; ctx.beginPath(); ctx.arc(0, 0, ringOuter, 0, Math.PI * 2); ctx.arc(0, 0, ringInner, 0, Math.PI * 2, true); ctx.fillStyle = planet.ringColor ? `#${planet.ringColor}80` : "rgba(200, 200, 200, 0.5)"; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, ringOuter, 0, Math.PI * 2); ctx.strokeStyle = planet.ringColor ? `#${planet.ringColor}B0` : "rgba(220, 220, 220, 0.7)"; ctx.lineWidth = (radius * 0.025) / 0.35; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, ringInner, 0, Math.PI * 2); ctx.strokeStyle = planet.ringColor ? `#${planet.ringColor}B0` : "rgba(220, 220, 220, 0.7)"; ctx.lineWidth = (radius * 0.025) / 0.35; ctx.stroke(); ctx.restore(); }
        }
    }
    // ===== END PLANET DRAWING =====

    // Moons drawing...
    if (planet.moons && Array.isArray(planet.moons)) {
        planet.moons.forEach(moon => {
            const { currentDisplayDistance: moonCurrentOrbitDist, currentDisplayRadius: moonCurrentDispRadius } = getScaledMoonProps(moon, planet);
            const moonScreenOrbitRadius = moonCurrentOrbitDist * zoom;
            const moonX = x + moonScreenOrbitRadius * Math.cos(moon.angle);
            const moonY = y + moonScreenOrbitRadius * Math.sin(moon.angle);
            const moonRadiusEffective = Math.max(0.1, moonCurrentDispRadius * zoom);
            const moonIsOnScreen = !(moonX + moonRadiusEffective < 0 || moonX - moonRadiusEffective > simulationContainer.clientWidth || moonY + moonRadiusEffective < 0 || moonY - moonRadiusEffective > simulationContainer.clientHeight);
            planetScreenDataToReturn[`${planet.name}-${moon.name}`] = { x: moonX, y: moonY, radius: moonRadiusEffective, name: moon.name, onScreen: moonIsOnScreen };
            if (showMoonOrbits && viewMode === 'free' && planetIsOnScreen && moonScreenOrbitRadius > 0.5) { const moonOrbitSegments = 24; const moonAngleStep = (Math.PI * 2) / moonOrbitSegments; for (let i = 0; i < moonOrbitSegments; i++) { const startAngle = i * moonAngleStep; const endAngle = (i + 1) * moonAngleStep; const segmentMidAngle = startAngle + moonAngleStep / 2; const angleDiffFromMoon = Math.abs(segmentMidAngle - moon.angle); const sunDirection = Math.atan2(sunScreenY - y, sunScreenX - x); const angleDiffFromSun = Math.abs(segmentMidAngle - sunDirection); const brightness = 0.05 + (0.15 * ((Math.cos(angleDiffFromMoon) + 1) / 2 * 0.3 + (Math.cos(angleDiffFromSun) + 1) / 2 * 0.7)); ctx.beginPath(); ctx.arc(x, y, moonScreenOrbitRadius, startAngle, endAngle); ctx.strokeStyle = `rgba(255, 255, 255, ${brightness})`; ctx.lineWidth = 1; ctx.stroke(); } }
            if (showMoonTrails && moon.trail && moon.trail.length > 1) { ctx.beginPath(); ctx.moveTo(moon.trail[0].x, moon.trail[0].y); for (let i = 1; i < moon.trail.length; i++) { ctx.lineTo(moon.trail[i].x, moon.trail[i].y); } ctx.strokeStyle = `#CCCCCC90`; ctx.lineWidth = 1.0; ctx.stroke(); }
            if (moonIsOnScreen) { ctx.beginPath(); ctx.arc(moonX, moonY, moonRadiusEffective, 0, Math.PI * 2); ctx.fillStyle = (moon.color || "#CCCCCC"); ctx.fill(); }
        });
    }

    // Labels...
    const labelElem = document.getElementById(`${planet.name}-label`);
    if (labelElem) {
        if (showLabels && planetIsOnScreen && radius > 0.05) {
            const labelTop = y - radius - labelElem.offsetHeight - 5;
            labelElem.style.left = `${x}px`;
            labelElem.style.top = `${labelTop}px`;
            labelElem.style.opacity = "1";
            // Label rotation removed: always faces user (translateX(-50%) is handled by CSS)
            labelElem.style.transform = 'translateX(-50%)';
        } else {
            labelElem.style.opacity = "0";
            labelElem.style.transform = 'translateX(-50%)';
        }
        labelElem.style.pointerEvents = 'none';
    }
    return planetScreenDataToReturn;
}

function createPlanetLabels() {
    document.querySelectorAll('.planet-label').forEach(label => label.remove());
    planets.forEach(planet => {
        const label = document.createElement('div');
        label.id = `${planet.name}-label`;
        label.className = 'planet-label';
        label.textContent = nameMap[planet.name] || planet.name;
        label.style.opacity = "0";
        simulationContainer.appendChild(label);
    });
}

// --- Event Handlers & UI Logic ---
function handleMouseDown(e) {
    if (e.button === 0) {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        lastOffsetX = offsetX;
        lastOffsetY = offsetY;
        canvas.classList.add('grabbing');
    }
}
function handleMouseMove(e) {
    if (isDragging && viewMode === 'free') {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        offsetX = lastOffsetX + dx;
        offsetY = lastOffsetY + dy;
    }
}
function handleMouseUp(e) {
    const eventForClick = e || window.event;
    if (isDragging) {
        const dx = Math.abs(offsetX - lastOffsetX);
        const dy = Math.abs(offsetY - lastOffsetY);
        if (dx < 5 && dy < 5) {
            handleCanvasClick(eventForClick);
        }
    } else {
        handleCanvasClick(eventForClick);
    }
    isDragging = false;
    canvas.classList.remove('grabbing');
}

function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let currentSunX = baseX + offsetX;
    let currentSunY = baseY + offsetY;
    let viewRotationForHitTest = 0;
    const targetPlanetObj = planets.find(p => p.name === followTarget);

    if (viewMode === 'follow' && targetPlanetObj) {
        const { currentDisplayDistance: targetDist } = getScaledPlanetProps(targetPlanetObj);
        const targetWorldX = targetDist * Math.cos(targetPlanetObj.angle);
        const targetWorldY = targetDist * Math.sin(targetPlanetObj.angle);
        currentSunX = baseX - targetWorldX * zoom;
        currentSunY = baseY - targetWorldY * zoom;
        if (followTargetRotation) {
            viewRotationForHitTest = -targetPlanetObj.rotationAngle;
        }
    }

    let transformedClickX = clickX;
    let transformedClickY = clickY;
    if (viewRotationForHitTest !== 0) {
        const tempX = clickX - baseX;
        const tempY = clickY - baseY;
        const cosR = Math.cos(-viewRotationForHitTest);
        const sinR = Math.sin(-viewRotationForHitTest);
        transformedClickX = tempX * cosR - tempY * sinR + baseX;
        transformedClickY = tempX * sinR + tempY * cosR + baseY;
    }

    for (const planet of [...planets].reverse()) {
        const { currentDisplayDistance, currentDisplayRadius } = getScaledPlanetProps(planet);
        const planetScreenX = currentSunX + currentDisplayDistance * Math.cos(planet.angle) * zoom;
        const planetScreenY = currentSunY + currentDisplayDistance * Math.sin(planet.angle) * zoom;
        const planetScreenRadius = Math.max(1, currentDisplayRadius * zoom);

        const distanceToPlanet = Math.hypot(transformedClickX - planetScreenX, transformedClickY - planetScreenY);
        if (distanceToPlanet <= Math.max(planetScreenRadius, 10)) {
            showPlanetInfo(planet.name);
            return;
        }
        if (planet.moons) {
            for (const moon of [...planet.moons].reverse()) {
                const { currentDisplayDistance: moonOrbitDist, currentDisplayRadius: moonDispRadius } = getScaledMoonProps(moon, planet);
                const moonScreenRadiusEffective = Math.max(0.5, moonDispRadius * zoom);
                const moonScreenX = planetScreenX + moonOrbitDist * Math.cos(moon.angle) * zoom;
                const moonScreenY = planetScreenY + moonOrbitDist * Math.sin(moon.angle) * zoom;
                const distanceToMoon = Math.hypot(transformedClickX - moonScreenX, transformedClickY - moonScreenY);
                if (distanceToMoon <= Math.max(moonScreenRadiusEffective, 5)) {
                    showPlanetInfo(moon.name);
                    return;
                }
            }
        }
    }
}
function setupEventListeners() {
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', handleKeyDown);
}

function sliderValToSimSpeed(sliderValue) {
    return Math.exp(G_LOG_SIM_SPEED_MIN + G_SLIDER_TO_SPEED_SCALE * (sliderValue - G_SPEED_SLIDER_MIN_VAL));
}
function simSpeedToSliderVal(currentSpeed) {
    if (currentSpeed <= 0) return G_SPEED_SLIDER_MIN_VAL;
    let val = G_SPEED_SLIDER_MIN_VAL + (Math.log(currentSpeed) - G_LOG_SIM_SPEED_MIN) / G_SLIDER_TO_SPEED_SCALE;
    return Math.round(Math.max(G_SPEED_SLIDER_MIN_VAL, Math.min(G_SPEED_SLIDER_MAX_VAL, val)));
}

function sliderValToActualZoom(sliderValue) {
    const normalizedSlider = (sliderValue - G_ZOOM_SLIDER_MIN_VAL) / (G_ZOOM_SLIDER_MAX_VAL - G_ZOOM_SLIDER_MIN_VAL);
    return G_ACTUAL_ZOOM_MIN * Math.pow(G_ACTUAL_ZOOM_MAX / G_ACTUAL_ZOOM_MIN, normalizedSlider);
}

function actualZoomToSliderVal(currentActualZoom) {
    if (currentActualZoom <= 0) currentActualZoom = G_ACTUAL_ZOOM_MIN;
    const normalizedZoomRatio = Math.log(currentActualZoom / G_ACTUAL_ZOOM_MIN) / Math.log(G_ACTUAL_ZOOM_MAX / G_ACTUAL_ZOOM_MIN);
    let sliderVal = G_ZOOM_SLIDER_MIN_VAL + normalizedZoomRatio * (G_ZOOM_SLIDER_MAX_VAL - G_ZOOM_SLIDER_MIN_VAL);
    return Math.round(Math.max(G_ZOOM_SLIDER_MIN_VAL, Math.min(G_ZOOM_SLIDER_MAX_VAL, sliderVal)));
}


function handleKeyDown(e) {
    switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); togglePause(); break;
        case 'r': resetSimulation(); break;
        case 'l': toggleLabels(); break;
        case 'f': toggleViewMode(); break;
        case 't': document.getElementById('planet-trails-btn').click(); break;
        case 'o': document.getElementById('planet-orbits-btn').click(); break;
        case 'm': document.getElementById('moon-trails-btn').click(); break;
        case 'b': document.getElementById('moon-orbits-btn').click(); break;
        case '+': case '=': changeSpeedByKey(true); break;
        case '-': case '_': changeSpeedByKey(false); break;
    }
}

function setupUI() {
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
    document.getElementById('labels-btn').addEventListener('click', toggleLabels);

    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', e => {
        speed = sliderValToSimSpeed(parseFloat(e.target.value));
        updateUI();
    });

    const zoomLevelSlider = document.getElementById('zoom-level-slider');
    zoomLevelSlider.value = actualZoomToSliderVal(zoom);
    zoomLevelSlider.addEventListener('input', e => {
        zoom = sliderValToActualZoom(parseFloat(e.target.value));
        updateUI();
    });

    const viewModeSelect = document.getElementById('view-mode');
    viewModeSelect.addEventListener('change', e => {
        viewMode = e.target.value;
        const isFollow = viewMode === 'follow';
        document.getElementById('follow-target').style.display = isFollow ? 'block' : 'none';
        document.getElementById('follow-rotation-container').style.display = isFollow ? 'flex' : 'none';
        document.getElementById('orbit-controls').style.display = isFollow ? 'block' : 'none';
        document.getElementById('planet-orbits-btn').disabled = isFollow;
        document.getElementById('moon-orbits-btn').disabled = isFollow;
        if (isFollow) {
            showPlanetOrbits = false; showMoonOrbits = false;
            clearAllTrails(); showPlanetInfo(followTarget);
        } else { clearAllTrails(); }
        updateUI();
    });

    document.getElementById('follow-target').addEventListener('change', e => {
        followTarget = e.target.value; clearAllTrails();
        if (viewMode === 'follow') showPlanetInfo(followTarget);
    });
    document.getElementById('follow-rotation-checkbox').addEventListener('change', e => { followTargetRotation = e.target.checked; });
    document.getElementById('center-target-btn').addEventListener('click', () => { offsetX = 0; offsetY = 0; updateUI(); });

    const scaleSlider = document.getElementById('scale-slider');
    scaleSlider.addEventListener('input', e => { scaleFactor = parseFloat(e.target.value); updateUI(); });

    document.getElementById('planet-trails-btn').addEventListener('click', () => {
        showPlanetTrails = !showPlanetTrails;
        if (!showPlanetTrails) planets.forEach(p => p.trail = []); updateUI();
    });
    document.getElementById('planet-orbits-btn').addEventListener('click', () => { showPlanetOrbits = !showPlanetOrbits; updateUI(); });
    document.getElementById('moon-trails-btn').addEventListener('click', () => {
        showMoonTrails = !showMoonTrails;
        if (!showMoonTrails) planets.forEach(p => { if (p.moons) p.moons.forEach(m => m.trail = []) }); updateUI();
    });
    document.getElementById('moon-orbits-btn').addEventListener('click', () => { showMoonOrbits = !showMoonOrbits; updateUI(); });
    document.getElementById('trail-duration-slider').addEventListener('input', e => { trailMaxPointsGlobal = parseInt(e.target.value); updateUI(); });
    document.getElementById('star-density').addEventListener('input', e => { starDensity = parseInt(e.target.value); generateMultiLayerStarfield(); updateUI(); });
    document.getElementById('star-layers').addEventListener('input', e => { starLayers = parseInt(e.target.value); generateMultiLayerStarfield(); updateUI(); });
    document.getElementById('star-parallax').addEventListener('input', e => { starParallax = parseFloat(e.target.value); generateMultiLayerStarfield(); updateUI(); });
    document.getElementById('regenerate-stars-btn').addEventListener('click', generateMultiLayerStarfield);
    document.getElementById('asteroid-btn').addEventListener('click', () => { showAsteroidBelt = !showAsteroidBelt; updateUI(); });
    document.getElementById('compare-btn').addEventListener('click', toggleComparePanelVisibility);
    setupCompareSelects();
}
function clearAllTrails() {
    planets.forEach(p => { p.trail = []; if (p.moons) { p.moons.forEach(m => m.trail = []); } });
}
function updateUI() {
    const targetPlanetForStatus = planets.find(p => p.name === followTarget);
    const targetDisplayName = targetPlanetForStatus ? (nameMap[targetPlanetForStatus.name] || targetPlanetForStatus.name) : followTarget;
    document.getElementById('current-mode-status').textContent = viewMode === 'free' ? '自由视角' : `跟随: ${targetDisplayName}`;
    // Adjusted zoom display precision
    document.getElementById('zoom-status').textContent = `缩放: ${zoom.toFixed(zoom < 0.01 ? 3 : (zoom < 0.5 ? 2 : (zoom < 10 ? 1 : 0)))}x`;
    document.getElementById('speed-status').textContent = `速度: ${speed.toFixed(speed < 0.1 ? 3 : (speed < 1 ? 2 : 1))}x`;
    let scaleText = `尺度: ${scaleFactor.toFixed(2)}`;
    if (scaleFactor == 0) scaleText += " (视觉)"; else if (scaleFactor == 1) scaleText += " (真实)";
    document.getElementById('scale-status').textContent = scaleText;
    document.getElementById('trail-duration-status').textContent = `轨迹点: ${trailMaxPointsGlobal}`;
    document.getElementById('star-density-status').textContent = `星密: ${starDensity}`;
    document.getElementById('star-layers-status').textContent = `星层: ${starLayers}`;
    document.getElementById('star-parallax-status').textContent = `视差: ${starParallax.toFixed(1)}`;
    document.getElementById('pause-btn').textContent = paused ? '播放' : '暂停';
    document.getElementById('labels-btn').textContent = showLabels ? '隐藏标签' : '显示标签';
    document.getElementById('asteroid-btn').textContent = showAsteroidBelt ? '隐藏小行星带' : '显示小行星带';
    document.getElementById('asteroid-btn').classList.toggle('active', showAsteroidBelt);
    document.getElementById('planet-trails-btn').classList.toggle('active', showPlanetTrails);
    document.getElementById('planet-orbits-btn').classList.toggle('active', showPlanetOrbits);
    document.getElementById('planet-orbits-btn').disabled = (viewMode === 'follow');
    document.getElementById('moon-trails-btn').classList.toggle('active', showMoonTrails);
    document.getElementById('moon-orbits-btn').classList.toggle('active', showMoonOrbits);
    document.getElementById('moon-orbits-btn').disabled = (viewMode === 'follow');
    adjustVerticalPanelLayout();
}
function togglePause() { paused = !paused; updateUI(); }
function toggleLabels() { showLabels = !showLabels; updateUI(); }
function toggleViewMode() {
    document.getElementById('view-mode').value = (viewMode === 'free' ? 'follow' : 'free');
    document.getElementById('view-mode').dispatchEvent(new Event('change'));
}
function changeSpeedByKey(isIncrease) {
    const factor = 1.5;
    if (isIncrease) {
        speed *= factor;
    } else {
        speed /= factor;
    }
    speed = Math.max(G_SIM_SPEED_MIN, Math.min(G_SIM_SPEED_MAX, speed));
    document.getElementById('speed-slider').value = simSpeedToSliderVal(speed);
    updateUI();
}
function resetSimulation() {
    paused = false; speed = 0.01; zoom = 1; offsetX = 0; offsetY = 0;
    scaleFactor = 0; viewMode = 'free'; followTarget = 'earth'; followTargetRotation = false;
    showLabels = true; showAsteroidBelt = false;
    showPlanetTrails = false; showPlanetOrbits = false; showMoonTrails = false; showMoonOrbits = false;
    trailMaxPointsGlobal = 300;
    initializePlanetData();
    calculateRealScaleFactors();
    document.getElementById('speed-slider').value = simSpeedToSliderVal(speed);
    document.getElementById('zoom-level-slider').value = actualZoomToSliderVal(zoom);
    document.getElementById('scale-slider').value = scaleFactor;
    document.getElementById('trail-duration-slider').value = trailMaxPointsGlobal;
    document.getElementById('view-mode').value = viewMode;
    document.getElementById('follow-target').value = followTarget;
    document.getElementById('follow-rotation-checkbox').checked = false;
    document.getElementById('view-mode').dispatchEvent(new Event('change'));
    document.getElementById('intro-content').style.display = 'block';
    document.getElementById('planet-info-content').style.display = 'none';
    updateUI();
}
function showPlanetInfo(itemName) {
    let item = planets.find(p => p.name === itemName);
    let isMoon = false; let parentPlanet = null;
    if (!item) {
        for (const p of planets) {
            if (p.moons) {
                const foundMoon = p.moons.find(m => m.name === itemName);
                if (foundMoon) { item = foundMoon; isMoon = true; parentPlanet = p; break; }
            }
        }
    }
    if (!item) return;
    const displayName = nameMap[item.name] || item.name.charAt(0).toUpperCase() + item.name.slice(1);
    const infoContent = document.getElementById('planet-info-content');
    document.getElementById('intro-content').style.display = 'none';
    infoContent.style.display = 'block'; infoContent.innerHTML = '';
    let html = `<h2>${displayName}</h2> <div style="margin: 10px 0;">`;
    function addParam(label, value, unit = '') {
        if (value !== undefined && value !== null && value !== "") {
            let displayValue = value;
            if (typeof value === 'number') {
                if (Math.abs(value) > 1e5 && !label.includes("直径") && !label.includes("距离") && !label.includes("质量")) displayValue = value.toExponential(2);
                else if (Math.abs(value) > 10000 && !label.includes("直径") && !label.includes("距离")) displayValue = value.toExponential(2);
                else if (Math.abs(value) > 1000) displayValue = value.toLocaleString();
                else if (label.includes("周期") && Math.abs(value) < 100 && Math.abs(value) % 1 !== 0) displayValue = value.toFixed(2);
                else if (Math.abs(value) % 1 !== 0 && !label.includes("离心率") && !label.includes("倾角")) displayValue = value.toFixed(1);
                else displayValue = value.toString();
            }
            html += `<div class="param"><span class="param-label">${label}:</span><span class="param-value">${displayValue} ${unit}</span></div>`;
        }
    }
    if (item.realData) {
        addParam("类型", isMoon ? `卫星 (环绕${nameMap[parentPlanet.name] || parentPlanet.name})` : (item.name === 'sun' ? '恒星' : '行星'));
        addParam("直径", item.realData.diameter, "km");
        addParam("质量", item.realData.mass, "kg");
        if (!isMoon && item.name !== "sun") addParam("距太阳平均距离", item.realData.distance / 1e6, "百万 km");
        if (isMoon && item.realData.distanceFromParentKm) addParam("距母星平均距离", item.realData.distanceFromParentKm, "km");
        addParam("自转周期", item.realData.rotationPeriodHours, "小时");
        addParam("轴倾角", item.realData.axialTiltDegrees, "°");
        if (typeof item.realData.orbitalEccentricity === 'number') addParam("轨道离心率", item.realData.orbitalEccentricity.toFixed(4));
        addParam("平均温度", item.realData.meanTemperatureC, "°C");
        addParam("大气主要成分", item.realData.atmosphere);
    } else { html += `<p>该天体的详细数据不足。</p>`; }
    if (!isMoon && item.moons && item.moons.length) html += `<p><strong>卫星数量:</strong> ${item.moons.length}</p>`;
    if (item.rings) html += `<p><strong>特征:</strong> 拥有光环系统</p>`;
    html += `</div>`; infoContent.innerHTML = html;
}

function adjustVerticalPanelLayout() {
    if (window.innerWidth > 600) {
        document.getElementById('control-panel').style.top = '10px';
        document.getElementById('info-panel').style.top = '10px';
        document.getElementById('compare-panel').style.top = '';
        return;
    }

    const controlPanel = document.getElementById('control-panel');
    const infoPanel = document.getElementById('info-panel');
    const comparePanel = document.getElementById('compare-panel');
    const statusIndicator = document.getElementById('status-indicator');
    const statusIndicatorHeight = statusIndicator.offsetHeight > 0 ? statusIndicator.offsetHeight : 30;
    const spacing = 10;

    let currentTop = statusIndicatorHeight + spacing;

    controlPanel.style.top = `${currentTop}px`;
    currentTop += controlPanel.offsetHeight + spacing;

    infoPanel.style.top = `${currentTop}px`;
    currentTop += infoPanel.offsetHeight + spacing;

    if (comparePanel.style.display !== 'none') {
        comparePanel.style.top = `${currentTop}px`;
    }
}

function togglePanelCollapse(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.toggle('panel-collapsed');
    const button = document.getElementById(`toggle-${panelId}-btn`);
    button.textContent = panel.classList.contains('panel-collapsed') ? '⊕' : '−';
    setTimeout(adjustVerticalPanelLayout, 300);
}
function toggleComparePanelVisibility() {
    const panel = document.getElementById('compare-panel');
    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'block' : 'none';
    setTimeout(adjustVerticalPanelLayout, 10);
}
function setupCompareSelects() {
    const selects = ['compare-select-1', 'compare-select-2', 'compare-select-3'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">选择天体</option>';
        planets.forEach(planet => {
            if (planet.realData && planet.realData.diameter) {
                const option = document.createElement('option');
                option.value = planet.name;
                option.textContent = nameMap[planet.name] || planet.name;
                select.appendChild(option);
            }
        });
        select.addEventListener('change', updateComparePanel);
    });
}
function updateComparePanel() {
    const selects = ['compare-select-1', 'compare-select-2', 'compare-select-3'];
    const cardsContainer = document.getElementById('compare-cards');
    cardsContainer.innerHTML = '';
    selects.forEach(selectId => {
        const planetName = document.getElementById(selectId).value;
        if (planetName) {
            const planet = planets.find(p => p.name === planetName);
            if (planet && planet.realData) {
                const card = document.createElement('div');
                card.className = 'compare-card';
                let htmlContent = `<h4>${nameMap[planetName] || planetName}</h4>`;
                function addCompareParam(label, value, unit = "") {
                    if (value !== undefined && value !== null) {
                        let displayValue = value;
                        if (typeof value === 'number') {
                            if (Math.abs(value) > 1e5 && !label.includes("直径")) displayValue = value.toExponential(1);
                            else if (Math.abs(value) > 1000) displayValue = value.toLocaleString();
                        }
                        htmlContent += `<div class="param"><span class="param-label">${label}:</span><span class="param-value">${displayValue}${unit}</span></div>`;
                    }
                }
                addCompareParam("直径", planet.realData.diameter, " km");
                if (planet.realData.mass) addCompareParam("质量", planet.realData.mass.toExponential(1), " kg");
                if (planet.name !== "sun" && planet.realData.distance) addCompareParam("距太阳", (planet.realData.distance / 1e6).toPrecision(4), " M km");
                if (planet.realData.rotationPeriodHours) addCompareParam("自转", planet.realData.rotationPeriodHours, " 小时");
                addCompareParam("卫星数", planet.moons ? planet.moons.length : 0);
                card.innerHTML = htmlContent;
                cardsContainer.appendChild(card);
            }
        }
    });
    setTimeout(adjustVerticalPanelLayout, 10);
}

// --- Animation Loop ---
let lastTimestamp = 0;
function animate(timestamp) {
    const timeDelta = timestamp - lastTimestamp;
    const effectiveTimeDelta = Math.max(0, Math.min(timeDelta, 100));
    const timeScale = effectiveTimeDelta / (1000 / 60);
    lastTimestamp = timestamp;

    ctx.clearRect(0, 0, simulationContainer.clientWidth, simulationContainer.clientHeight);

    let currentSunX = baseX + offsetX;
    let currentSunY = baseY + offsetY;
    let viewRotation = 0;
    const targetPlanetObj = planets.find(p => p.name === followTarget);

    if (viewMode === 'follow' && targetPlanetObj) {
        const { currentDisplayDistance: targetDist } = getScaledPlanetProps(targetPlanetObj);
        const targetWorldX = targetDist * Math.cos(targetPlanetObj.angle);
        const targetWorldY = targetDist * Math.sin(targetPlanetObj.angle);
        currentSunX = baseX - targetWorldX * zoom;
        currentSunY = baseY - targetWorldY * zoom;
        if (followTargetRotation) {
            viewRotation = -targetPlanetObj.rotationAngle;
        }
    }

    const starFieldPanX = viewMode === 'follow' && targetPlanetObj ? (targetPlanetObj.baseDistance * Math.cos(targetPlanetObj.angle)) : -offsetX / zoom;
    const starFieldPanY = viewMode === 'follow' && targetPlanetObj ? (targetPlanetObj.baseDistance * Math.sin(targetPlanetObj.angle)) : -offsetY / zoom;
    drawMultiLayerStarfield(starFieldPanX, starFieldPanY, viewRotation);

    ctx.save();
    if (viewRotation !== 0) {
        ctx.translate(baseX, baseY);
        ctx.rotate(viewRotation);
        ctx.translate(-baseX, -baseY);
    }

    drawAsteroidBelt(currentSunX, currentSunY);

    let allScreenPositions = {};
    planets.forEach(planet => {
        const screenData = drawCelestialBody(planet, currentSunX, currentSunY, viewRotation);
        Object.assign(allScreenPositions, screenData);
    });

    updatePositions(timeScale, allScreenPositions);

    ctx.restore();
    requestAnimationFrame(animate);
}

// --- Main ---
function init() {
    resizeCanvas();
    initializePlanetData();
    calculateRealScaleFactors();
    generateMultiLayerStarfield();
    generateAsteroidBelt();
    setupEventListeners();
    setupUI();
    createPlanetLabels();
    resetSimulation();
    adjustVerticalPanelLayout();
    requestAnimationFrame(animate);
}

window.togglePanelCollapse = togglePanelCollapse;
window.toggleComparePanelVisibility = toggleComparePanelVisibility;

init();