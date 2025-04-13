import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

export default function DataViz() {
  const ringsRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (ringsRef.current) {
      ringsRef.current.rotation.z = clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <group ref={ringsRef}>
      {/* Data Flow Rings */}
      {[...Array(3)].map((_, i) => (
        <mesh key={i} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2 + i * 0.3, 0.02, 16, 100]} />
          <MeshDistortMaterial
            color="#34d399"
            speed={2}
            distort={0.3}
            radius={1}
            transparent
            opacity={0.6 - i * 0.1}
          />
        </mesh>
      ))}

      {/* Data Points */}
      {[...Array(20)].map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const radius = 2;
        return (
          <mesh
            key={`point-${i}`}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle) * radius,
              0
            ]}
          >
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshPhongMaterial
              color="#34d399"
              emissive="#34d399"
              emissiveIntensity={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}