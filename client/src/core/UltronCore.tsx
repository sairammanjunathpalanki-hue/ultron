import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UltronState } from '../../../shared/types';

interface UltronCoreProps {
  state: UltronState;
  audioAmplitude?: number; // 0.0 to 1.0 from microphone or voice speech
  quality?: 'high' | 'medium' | 'low';
  onTap?: () => void;
  // Gesture Continuous & Trigger Inputs
  zoomDelta?: number;
  panOffset?: { x: number; y: number };
  rotationDelta?: number;
  energyPulse?: number;
  handPos?: { x: number; y: number };
}

export const UltronCore: React.FC<UltronCoreProps> = ({
  state = 'IDLE',
  audioAmplitude = 0.0,
  quality = 'high',
  onTap,
  zoomDelta = 0,
  panOffset = { x: 0, y: 0 },
  rotationDelta = 0,
  energyPulse = 0,
  handPos,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  // References for dynamic animation updates
  const stateRef = useRef<UltronState>(state);
  const audioAmpRef = useRef<number>(audioAmplitude);
  const zoomDeltaRef = useRef<number>(zoomDelta);
  const panOffsetRef = useRef<{ x: number; y: number }>(panOffset);
  const rotationDeltaRef = useRef<number>(rotationDelta);
  const energyPulseRef = useRef<number>(energyPulse);
  const handPosRef = useRef<{ x: number; y: number } | undefined>(handPos);

  stateRef.current = state;
  audioAmpRef.current = audioAmplitude;
  zoomDeltaRef.current = zoomDelta;
  panOffsetRef.current = panOffset;
  rotationDeltaRef.current = rotationDelta;
  energyPulseRef.current = energyPulse;
  handPosRef.current = handPos;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030306);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 24;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: quality !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. Central Core Spheres (Layered Glow & Core)
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    const coreGroup = new THREE.Group();
    masterGroup.add(coreGroup);

    // Inner bright core
    const innerCoreGeo = new THREE.SphereGeometry(1.6, 32, 32);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffe680,
      transparent: true,
      opacity: 0.9,
    });
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    coreGroup.add(innerCore);

    // Middle Radiant Orange Energy Sphere
    const midCoreGeo = new THREE.SphereGeometry(2.3, 32, 32);
    const midCoreMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const midCore = new THREE.Mesh(midCoreGeo, midCoreMat);
    coreGroup.add(midCore);

    // Outer Soft Glow Sphere
    const glowGeo = new THREE.SphereGeometry(3.0, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    coreGroup.add(glowSphere);

    // 4. Orbital Rings (Multi-axis holographic rings)
    const ringsGroup = new THREE.Group();
    masterGroup.add(ringsGroup);

    interface RingConfig {
      radius: number;
      tiltX: number;
      tiltY: number;
      tiltZ: number;
      speed: number;
      color: number;
      mesh: THREE.Line;
    }

    const ringDefs = [
      { radius: 4.0, tiltX: 0.2, tiltY: 0.0, tiltZ: 0.1, speed: 1.0, color: 0xffaa00 },
      { radius: 5.2, tiltX: 1.1, tiltY: 0.4, tiltZ: 0.3, speed: -0.8, color: 0xff8800 },
      { radius: 6.4, tiltX: 0.5, tiltY: 1.2, tiltZ: 0.6, speed: 1.2, color: 0xffcc33 },
      { radius: 7.8, tiltX: 1.4, tiltY: 0.8, tiltZ: 0.9, speed: -0.6, color: 0xff6600 },
    ];

    const ringConfigs: RingConfig[] = ringDefs.map((def) => {
      const curve = new THREE.EllipseCurve(0, 0, def.radius, def.radius, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(128);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineDashedMaterial({
        color: def.color,
        dashSize: 0.8,
        gapSize: 0.3,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });

      const mesh = new THREE.Line(geometry, material);
      mesh.computeLineDistances();
      mesh.rotation.x = def.tiltX;
      mesh.rotation.y = def.tiltY;
      mesh.rotation.z = def.tiltZ;
      ringsGroup.add(mesh);

      return { ...def, mesh };
    });

    // Outer HUD circle with ticks
    const hudRingCurve = new THREE.EllipseCurve(0, 0, 9.2, 9.2, 0, 2 * Math.PI, false, 0);
    const hudRingGeo = new THREE.BufferGeometry().setFromPoints(hudRingCurve.getPoints(96));
    const hudRingMat = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.3,
    });
    const hudRing = new THREE.Line(hudRingGeo, hudRingMat);
    masterGroup.add(hudRing);

    // 5. Energy Pulse Expanding Ring (Triggered by gestures)
    const pulseRingCurve = new THREE.EllipseCurve(0, 0, 1.0, 1.0, 0, 2 * Math.PI, false, 0);
    const pulseRingGeo = new THREE.BufferGeometry().setFromPoints(pulseRingCurve.getPoints(64));
    const pulseRingMat = new THREE.LineBasicMaterial({
      color: 0xffe680,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const pulseRing = new THREE.Line(pulseRingGeo, pulseRingMat);
    masterGroup.add(pulseRing);

    // 6. Volumetric Holographic Particle Swarm
    const particleCount = quality === 'high' ? 3200 : quality === 'medium' ? 2000 : 1000;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleCol = new Float32Array(particleCount * 3);

    const cGold = new THREE.Color(0xffaa00);
    const cAmber = new THREE.Color(0xff6600);
    const cWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 8.5 + 2.0;

      const sinPhi = Math.sin(phi);
      const x = r * sinPhi * Math.cos(theta);
      const y = r * sinPhi * Math.sin(theta);
      const z = r * Math.cos(phi);

      particlePos[i * 3] = x;
      particlePos[i * 3 + 1] = y;
      particlePos[i * 3 + 2] = z;

      const colChoice = Math.random();
      const c = colChoice > 0.85 ? cWhite : colChoice > 0.45 ? cGold : cAmber;
      particleCol[i * 3] = c.r;
      particleCol[i * 3 + 1] = c.g;
      particleCol[i * 3 + 2] = c.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleCol, 3));

    const particleMat = new THREE.PointsMaterial({
      size: quality === 'high' ? 0.09 : 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    masterGroup.add(particleSystem);

    // Dynamic scale and pan variables
    let currentZoom = 1.0;
    let currentPan = { x: 0, y: 0 };
    let currentRotZ = 0;
    let pulseProgress = 1.0; // 0.0 to 1.0
    let lastHandledPulse = 0;

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || window.innerHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();
      const currentState = stateRef.current;
      const audioAmp = audioAmpRef.current;

      // Check for energy pulse triggers
      if (energyPulseRef.current !== lastHandledPulse) {
        lastHandledPulse = energyPulseRef.current;
        pulseProgress = 0.0;
      }

      // Smoothly update zoom with zoomDelta input
      if (zoomDeltaRef.current !== 0) {
        currentZoom += zoomDeltaRef.current * 0.15;
        currentZoom = Math.max(0.45, Math.min(2.8, currentZoom));
      }

      // Smoothly update pan
      const targetPan = panOffsetRef.current;
      currentPan.x += (targetPan.x - currentPan.x) * 0.15;
      currentPan.y += (-targetPan.y - currentPan.y) * 0.15; // Invert Y for 3D screen space

      // Smoothly update rotation
      if (rotationDeltaRef.current !== 0) {
        currentRotZ += rotationDeltaRef.current * 0.2;
      }

      // Apply zoom & pan to master group
      masterGroup.scale.set(currentZoom, currentZoom, currentZoom);
      masterGroup.position.x = currentPan.x * 4.0;
      masterGroup.position.y = currentPan.y * 4.0;
      masterGroup.rotation.z = currentRotZ;

      // Speed multipliers based on state
      let speedMult = 1.0;
      let particleSwirl = 1.0;
      let coreScale = 1.0;
      let glowColor = new THREE.Color(0xff5500);

      switch (currentState) {
        case 'IDLE':
          speedMult = 0.8;
          coreScale = 1.0 + Math.sin(elapsed * 2) * 0.04;
          break;
        case 'LISTENING':
          speedMult = 1.2;
          coreScale = 1.05 + audioAmp * 0.65;
          glowColor = new THREE.Color(0xffaa00);
          break;
        case 'THINKING':
          speedMult = 2.8;
          particleSwirl = 2.5;
          coreScale = 1.1 + Math.sin(elapsed * 8) * 0.08;
          glowColor = new THREE.Color(0xffbb33);
          break;
        case 'SPEAKING':
          speedMult = 1.4;
          coreScale = 1.08 + audioAmp * 0.5 + Math.sin(elapsed * 6) * 0.06;
          glowColor = new THREE.Color(0xff8800);
          break;
        case 'EXECUTING':
          speedMult = 2.2;
          coreScale = 1.15;
          glowColor = new THREE.Color(0xff9900);
          break;
        case 'WAITING_FOR_CONFIRMATION':
          speedMult = 0.25;
          coreScale = 1.0 + Math.sin(elapsed * 4) * 0.12;
          glowColor = new THREE.Color(0xffcc00);
          break;
        case 'STOPPED':
          speedMult = 0.15;
          coreScale = 0.95;
          break;
        case 'ERROR':
          speedMult = 0.5;
          coreScale = 1.0 + Math.sin(elapsed * 10) * 0.1;
          glowColor = new THREE.Color(0xff2222);
          break;
      }

      // Energy Pulse Animation
      if (pulseProgress < 1.0) {
        pulseProgress += 0.035;
        const pScale = 1.0 + pulseProgress * 12.0;
        pulseRing.scale.set(pScale, pScale, pScale);
        pulseRingMat.opacity = Math.max(0, 0.9 * (1.0 - pulseProgress));
        speedMult *= 1.8;
      } else {
        pulseRingMat.opacity = 0.0;
      }

      // Apply Core Scaling & Colors
      innerCore.scale.set(coreScale, coreScale, coreScale);
      midCore.scale.set(coreScale * 1.05, coreScale * 1.05, coreScale * 1.05);
      glowSphere.scale.set(coreScale * 1.15, coreScale * 1.15, coreScale * 1.15);
      glowMat.color.lerp(glowColor, 0.1);

      // Rotate central spheres
      coreGroup.rotation.y += 0.005 * speedMult;
      coreGroup.rotation.x = Math.sin(elapsed * 0.5) * 0.1;

      // Animate Orbital Rings
      ringConfigs.forEach((rc) => {
        rc.mesh.rotation.z += rc.speed * 0.008 * speedMult;
        rc.mesh.rotation.y += rc.speed * 0.005 * speedMult;
      });

      // Animate HUD Outer Ring
      hudRing.rotation.z += 0.002 * speedMult;

      // Animate Particles with optional Hand Attraction
      const positions = particleGeo.attributes.position.array as Float32Array;
      const hp = handPosRef.current;
      const hand3dX = hp ? (hp.x - 0.5) * 14 : 0;
      const hand3dY = hp ? -(hp.y - 0.5) * 14 : 0;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        let px = positions[i3];
        let py = positions[i3 + 1];
        let pz = positions[i3 + 2];

        // Orbit around Y axis
        const angle = 0.005 * speedMult * particleSwirl;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        let newX = px * cosA - pz * sinA;
        let newZ = px * sinA + pz * cosA;
        let newY = py + Math.sin(elapsed * 2 + i) * 0.003;

        // Subtle gravitational pull toward hand coordinates
        if (hp) {
          const dx = hand3dX - newX;
          const dy = hand3dY - newY;
          const distSq = dx * dx + dy * dy;
          if (distSq < 30) {
            newX += dx * 0.012;
            newY += dy * 0.012;
          }
        }

        positions[i3] = newX;
        positions[i3 + 1] = newY;
        positions[i3 + 2] = newZ;
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [quality]);

  return (
    <div
      ref={containerRef}
      onClick={onTap}
      className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden cursor-pointer"
      style={{ zIndex: 1, touchAction: 'manipulation' }}
      title="Tap core to speak with Ultron"
    />
  );
};
