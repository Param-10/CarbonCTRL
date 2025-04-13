import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Stars, Trail, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function Earth3D() {
  const earthRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const satelliteRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const elapsedTime = clock.getElapsedTime();
    
    if (earthRef.current) {
      earthRef.current.rotation.y = elapsedTime * 0.1;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y = elapsedTime * 0.12;
      atmosphereRef.current.scale.setScalar(1 + Math.sin(elapsedTime * 0.5) * 0.02);
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = elapsedTime * 0.15;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = elapsedTime * 0.05;
    }
    if (satelliteRef.current) {
      satelliteRef.current.position.x = Math.cos(elapsedTime * 0.5) * 2;
      satelliteRef.current.position.z = Math.sin(elapsedTime * 0.5) * 2;
      satelliteRef.current.rotation.y = elapsedTime * 0.5;
    }
  });

  return (
    <group>
      {/* Enhanced stars background */}
      <Stars 
        radius={100}
        depth={50}
        count={7000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />

      {/* Earth core with enhanced material */}
      <Sphere ref={earthRef} args={[1, 64, 64]}>
        <meshPhysicalMaterial
          color="#10b981"
          emissive="#059669"
          emissiveIntensity={0.6}
          metalness={0.9}
          roughness={0.2}
          clearcoat={0.8}
          clearcoatRoughness={0.2}
          normalScale={new THREE.Vector2(0.5, 0.5)}
        />
      </Sphere>

      {/* Enhanced atmosphere layer with pulsing effect */}
      <Sphere ref={atmosphereRef} args={[1.2, 32, 32]}>
        <meshPhongMaterial
          color="#34d399"
          transparent
          opacity={0.3}
          wireframe
          emissive="#34d399"
          emissiveIntensity={0.2}
        />
      </Sphere>

      {/* Enhanced cloud layer with dynamic patterns */}
      <Sphere ref={cloudsRef} args={[1.1, 32, 32]}>
        <meshPhongMaterial
          color="#fff"
          transparent
          opacity={0.15}
          wireframe
          emissive="#fff"
          emissiveIntensity={0.1}
        />
      </Sphere>

      {/* Data visualization ring with enhanced effects */}
      <points ref={particlesRef}>
        <torusGeometry args={[1.8, 0.1, 16, 100]} />
        <pointsMaterial
          size={0.02}
          color="#34d399"
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Enhanced satellite with longer trail */}
      <Trail
        width={0.05}
        length={8}
        color="#34d399"
        attenuation={(t) => t * t}
      >
        <mesh ref={satelliteRef} position={[2, 0, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.2]} />
          <meshPhongMaterial
            color="#34d399"
            emissive="#34d399"
            emissiveIntensity={0.5}
          />
        </mesh>
      </Trail>

      {/* Enhanced energy pulses */}
      {[...Array(5)].map((_, i) => (
        <points key={i}>
          <sphereGeometry args={[1.5 + i * 0.2, 16, 16]} />
          <pointsMaterial
            size={0.02}
            color="#34d399"
            transparent
            opacity={0.3 - i * 0.05}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </group>
  );
}