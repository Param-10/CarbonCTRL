import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Stars, Trail, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function Earth3D() {
  const earthRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const satelliteRef = useRef<THREE.Mesh>(null);

  // Optimize geometries by creating them once with useMemo
  const geometries = useMemo(() => {
    return {
      sphere: new THREE.SphereGeometry(1, 32, 32), // Reduced segments from 64 to 32
      atmosphere: new THREE.SphereGeometry(1.2, 24, 24), // Reduced segments
      clouds: new THREE.SphereGeometry(1.1, 24, 24), // Reduced segments
      torus: new THREE.TorusGeometry(1.8, 0.1, 16, 50), // Reduced segments from 100 to 50
      satellite: new THREE.BoxGeometry(0.1, 0.1, 0.2)
    };
  }, []);

  // Optimize materials by creating them once with useMemo
  const materials = useMemo(() => {
    return {
      earth: new THREE.MeshPhysicalMaterial({
        color: "#10b981",
        emissive: "#059669",
        emissiveIntensity: 0.6,
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        normalScale: new THREE.Vector2(0.5, 0.5)
      }),
      atmosphere: new THREE.MeshPhongMaterial({
        color: "#34d399",
        transparent: true,
        opacity: 0.3,
        wireframe: true,
        emissive: "#34d399",
        emissiveIntensity: 0.2
      }),
      clouds: new THREE.MeshPhongMaterial({
        color: "#fff",
        transparent: true,
        opacity: 0.15,
        wireframe: true,
        emissive: "#fff",
        emissiveIntensity: 0.1
      }),
      particles: new THREE.PointsMaterial({
        size: 0.02,
        color: "#34d399",
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
      }),
      satellite: new THREE.MeshPhongMaterial({
        color: "#34d399",
        emissive: "#34d399",
        emissiveIntensity: 0.5
      })
    };
  }, []);

  // Optimize energy pulses by pre-computing geometries
  const energyPulses = useMemo(() => {
    return [...Array(3)].map((_, i) => ({ // Reduced from 5 to 3 pulses
      geometry: new THREE.SphereGeometry(1.5 + i * 0.2, 12, 12), // Reduced segments
      material: new THREE.PointsMaterial({
        size: 0.02,
        color: "#34d399",
        transparent: true,
        opacity: 0.3 - i * 0.05,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
      })
    }));
  }, []);

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
      {/* Optimized stars with reduced count */}
      <Stars 
        radius={100}
        depth={50}
        count={5000} // Reduced from 7000
        factor={4}
        saturation={0}
        fade
        speed={1}
      />

      {/* Earth core with memoized geometry and material */}
      <mesh ref={earthRef} geometry={geometries.sphere} material={materials.earth} />

      {/* Atmosphere with memoized geometry and material */}
      <mesh ref={atmosphereRef} geometry={geometries.atmosphere} material={materials.atmosphere} />

      {/* Clouds with memoized geometry and material */}
      <mesh ref={cloudsRef} geometry={geometries.clouds} material={materials.clouds} />

      {/* Data visualization ring with memoized geometry and material */}
      <points ref={particlesRef} geometry={geometries.torus} material={materials.particles} />

      {/* Satellite with trail */}
      <Trail
        width={0.05}
        length={8}
        color="#34d399"
        attenuation={(t) => t * t}
      >
        <mesh ref={satelliteRef} position={[2, 0, 0]} geometry={geometries.satellite} material={materials.satellite} />
      </Trail>

      {/* Optimized energy pulses */}
      {energyPulses.map((pulse, i) => (
        <points key={i} geometry={pulse.geometry} material={pulse.material} />
      ))}
    </group>
  );
}