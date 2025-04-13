import React from 'react';
import { Canvas, extend } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Effects, Float, MeshDistortMaterial, GradientTexture } from '@react-three/drei';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import Earth3D from './Earth3D';
import DataViz from './DataViz';
import * as THREE from 'three';

// Properly extend UnrealBloomPass using react-three-fiber's extend
extend({ UnrealBloomPass });

export default function Scene3D() {
  return (
    <div className="absolute inset-0 -z-10 opacity-90">
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={60} />
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#34d399" />
        <spotLight
          position={[-10, 0, 0]}
          angle={0.3}
          penumbra={1}
          intensity={0.8}
          castShadow
          color="#34d399"
        />
        
        {/* Enhanced bloom effect */}
        <Effects>
          <unrealBloomPass
            threshold={0.1}
            strength={1.2}
            radius={0.8}
          />
        </Effects>

        {/* Main Earth component with floating animation */}
        <Float
          speed={2}
          rotationIntensity={0.5}
          floatIntensity={0.5}
        >
          <Earth3D />
        </Float>

        {/* Data visualization rings */}
        <DataViz />

        {/* Ambient particles */}
        <AmbientParticles count={100} />

        {/* Enhanced controls */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
          dampingFactor={0.05}
          rotateSpeed={0.5}
        />

        {/* Enhanced atmosphere */}
        <fog attach="fog" args={['#0f172a', 5, 15]} />
      </Canvas>
    </div>
  );
}

function AmbientParticles({ count }) {
  const positions = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#34d399"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}