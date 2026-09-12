import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UltronState } from '../../../shared/types';

interface UltronCoreProps {
  state: UltronState;
  audioAmplitude?: number; // 0.0 to 1.0 from microphone or voice speech
  quality?: 'high' | 'medium' | 'low';
  onTap?: () => void;
}

export const UltronCore: React.FC<UltronCoreProps> = ({
  state = 'IDLE',
  audioAmplitude = 0.0,
  quality = 'high',
  onTap,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number | null>(null);

  // References for dynamic animation updates
  const stateRef = useRef<UltronState>(state);
  const audioAmpRef = useRef<number>(audioAmplitude);
  stateRef.current = state;
  audioAmpRef.current = audioAmplitude;

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
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

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

    // 4. Orbital Rings (Multi-axis holographic rings matching reference video)
    const ringsGroup = new THREE.Group();
    scene.add(ringsGroup);

    interface RingConfig {
      radius: number;
      tiltX: number;
      tiltY: number;
      tiltZ: number;
      speed: number;
      color: number;
      dashSize?: number;
      gapSize?: number;
      mesh: THREE.Line;
    }

    const ringConfigs: RingConfig[] = [];
    const ringDefinitions = [
      { r: 4.2, rx: 0.2, ry: 0.5, rz: 0.1, speed: 0.6, col: 0xffaa00 },
      { r: 5.2, rx: Math.PI / 2.8, ry: 0.2, rz: 0.4, speed: -0.75, col: 0xff7700 },
      { r: 6.3, rx: 0.8, ry: Math.PI / 3, rz: 0.3, speed: 0.9, col: 0xffbb22 },
      { r: 7.4, rx: Math.PI / 1.8, ry: 0.7, rz: 0.2, speed: -0.5, col: 0xff9900 },
      { r: 8.6, rx: 0.4, ry: Math.PI / 1.5, rz: 0.6, speed: 0.7, col: 0xffaa00 },
      { r: 10.0, rx: Math.PI / 4, ry: Math.PI / 4, rz: 0, speed: -0.4, col: 0xff6600 },
    ];

    ringDefinitions.forEach((def) => {
      const curve = new THREE.EllipseCurve(0, 0, def.r, def.r, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(120);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(points);

      const ringMat = new THREE.LineDashedMaterial({
        color: def.col,
        linewidth: 1.5,
        scale: 1,
        dashSize: 0.8,
        gapSize: 0.25,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });

      const line = new THREE.Line(ringGeo, ringMat);
      line.computeLineDistances();
      line.rotation.set(def.rx, def.ry, def.rz);
      ringsGroup.add(line);

      ringConfigs.push({
        radius: def.r,
        tiltX: def.rx,
        tiltY: def.ry,
        tiltZ: def.rz,
        speed: def.speed,
        color: def.col,
        mesh: line,
      });
    });

    // 5. Dense Particle Cloud (Thousands of gold/orange particles orbiting the center)
    const particleCount = quality === 'high' ? 3500 : quality === 'medium' ? 2200 : 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleVel = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleColors = new Float32Array(particleCount * 3);

    const baseColor1 = new THREE.Color(0xffaa00);
    const baseColor2 = new THREE.Color(0xff4400);
    const brightColor = new THREE.Color(0xffe680);

    for (let i = 0; i < particleCount; i++) {
      // Spherical shell distribution with variance
      const radius = 2.5 + Math.pow(Math.random(), 1.5) * 8.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      particlePos[i * 3] = x;
      particlePos[i * 3 + 1] = y;
      particlePos[i * 3 + 2] = z;

      // Angular orbital velocities
      particleVel[i * 3] = (Math.random() - 0.5) * 0.02;
      particleVel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      particleVel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      particleSizes[i] = Math.random() * 2.2 + 0.8;

      const mixed = Math.random() > 0.8 ? brightColor : Math.random() > 0.4 ? baseColor1 : baseColor2;
      particleColors[i * 3] = mixed.r;
      particleColors[i * 3 + 1] = mixed.g;
      particleColors[i * 3 + 2] = mixed.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    // Particle Material with circular texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 170, 0, 0.8)');
      grad.addColorStop(0.8, 'rgba(255, 80, 0, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const particleTex = new THREE.CanvasTexture(canvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.28,
      map: particleTex,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 6. Exterior Circular Hologram HUD Overlay Rings (Flat plane facing camera)
    const hudRingGeo = new THREE.RingGeometry(11.2, 11.25, 64);
    const hudRingMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
    });
    const hudRing = new THREE.Mesh(hudRingGeo, hudRingMat);
    scene.add(hudRing);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop with AI State Transitions
    let clock = new THREE.Clock();
    let pulseTime = 0;

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      const currentState = stateRef.current;
      const audioAmp = audioAmpRef.current;

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
          glowColor = new THREE.Color(0xffcc00); // Glowing amber/gold warning
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

      // Apply Core Scaling & Colors
      innerCore.scale.set(coreScale, coreScale, coreScale);
      midCore.scale.set(coreScale * 1.05, coreScale * 1.05, coreScale * 1.05);
      glowSphere.scale.set(coreScale * 1.15, coreScale * 1.15, coreScale * 1.15);
      glowMat.color.lerp(glowColor, 0.1);

      // Rotate central spheres
      coreGroup.rotation.y += 0.005 * speedMult;
      coreGroup.rotation.x = Math.sin(elapsed * 0.5) * 0.1;

      // Animate Orbital Rings
      ringConfigs.forEach((rc, idx) => {
        rc.mesh.rotation.z += rc.speed * 0.008 * speedMult;
        rc.mesh.rotation.y += rc.speed * 0.005 * speedMult;
        
        // Highlight active ring during execution
        if (currentState === 'EXECUTING' && idx === 2) {
          (rc.mesh.material as THREE.LineDashedMaterial).color.setHex(0xffffff);
          (rc.mesh.material as THREE.LineDashedMaterial).opacity = 0.95;
        } else {
          (rc.mesh.material as THREE.LineDashedMaterial).color.setHex(rc.color);
          (rc.mesh.material as THREE.LineDashedMaterial).opacity = 0.65;
        }
      });

      // Animate HUD Outer Ring
      hudRing.rotation.z += 0.002 * speedMult;

      // Animate Particles
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        let px = positions[i3];
        let py = positions[i3 + 1];
        let pz = positions[i3 + 2];

        // Orbit around Y axis
        const angle = 0.005 * speedMult * particleSwirl;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const newX = px * cosA - pz * sinA;
        const newZ = px * sinA + pz * cosA;

        // Subtle vertical bobbing
        const newY = py + Math.sin(elapsed * 2 + i) * 0.003;

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
