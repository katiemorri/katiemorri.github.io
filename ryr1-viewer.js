import * as THREE from './lib/three/three.module.js';
import { PDBLoader } from './lib/three/examples/jsm/loaders/PDBLoader.js';

class RYR1Viewer {
  constructor(canvas, container) {
    console.log('🧬 RYR1Viewer initializing...');
    console.log('Canvas:', canvas);
    console.log('Container:', container);
    
    this.canvas = canvas;
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.protein = null;
    this.animationId = null;

    try {
      this.init();
      this.loadProtein();
      this.animate();
      console.log('✅ RYR1Viewer initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing RYR1Viewer:', error);
      console.error(error.stack);
    }

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  init() {
    console.log('📐 Setting up Three.js scene...');
    console.log('Canvas element:', this.canvas);
    console.log('Canvas offsetWidth:', this.canvas.offsetWidth);
    console.log('Canvas offsetHeight:', this.canvas.offsetHeight);
    console.log('Canvas clientWidth:', this.canvas.clientWidth);
    console.log('Canvas clientHeight:', this.canvas.clientHeight);
    
    // Get size from canvas itself first
    let width = this.canvas.clientWidth;
    let height = this.canvas.clientHeight;
    
    console.log('Initial dimensions from canvas:', width, height);
    
    if (!width || width === 0) {
      width = window.innerWidth;
      console.log('Using window width:', width);
    }
    if (!height || height === 0) {
      height = 600;
      console.log('Using default height:', height);
    }
    
    console.log(`📏 Final canvas size: ${width} x ${height}`);
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      10000
    );
    camera.position.z = 150;
    this.camera = camera;
    console.log('📷 Camera created');

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    
    console.log('Before setSize:', this.canvas.width, this.canvas.height);
    renderer.setSize(width, height, false);
    console.log('After setSize:', this.canvas.width, this.canvas.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer = renderer;
    
    console.log('🎨 Renderer created and sized');

    // Lighting
    const light = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(light);
    console.log('💡 Light added');

    // Test cube
    const geometry = new THREE.BoxGeometry(40, 40, 40);
    const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
    console.log('📦 Test cube added');
    
    // Immediately render once
    console.log('🎬 Rendering initial frame...');
    this.renderer.render(this.scene, this.camera);
    console.log('✅ Render complete');
  }

  addStars() {
    console.log('⭐ Adding starfield...');
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 4000;
      positions[i + 1] = (Math.random() - 0.5) * 4000;
      positions[i + 2] = (Math.random() - 0.5) * 4000;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
  }

  loadProtein() {
    console.log('📦 Loading RYR1 protein from assets/8X48.pdb...');
    
    const loader = new PDBLoader();
    const url = './assets/8X48.pdb';

    loader.load(
      url,
      (pdb) => {
        console.log('✅ Protein loaded:', pdb);
        this.onProteinLoaded(pdb);
      },
      (xhr) => {
        if (xhr.total) {
          const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
          console.log(`📥 Loading: ${percent}%`);
        }
      },
      (error) => {
        console.error('❌ Error loading protein:', error);
      }
    );
  }

  onProteinLoaded(pdb) {
    console.log('🔬 Processing protein geometry...');
    
    const geometryAtoms = pdb.geometryAtoms;
    const json = pdb.json;

    // Center the protein
    geometryAtoms.computeBoundingBox();
    const offset = new THREE.Vector3();
    geometryAtoms.boundingBox.getCenter(offset).negate();

    geometryAtoms.translate(offset.x, offset.y, offset.z);

    // Render atoms
    this.renderAtomsInstanced(geometryAtoms);

    console.log(`✨ RYR1 protein loaded with ${json.atoms.length} atoms`);
  }

  renderAtomsInstanced(geometryAtoms) {
    const positions = geometryAtoms.getAttribute('position');
    const colors = geometryAtoms.getAttribute('color');
    const totalAtoms = positions.count;
    const rejectionRate = 0.15; // Skip 15% of atoms for performance
    const renderedAtoms = Math.floor(totalAtoms * (1 - rejectionRate));

    // Create instanced mesh for atoms
    const sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
    const material = new THREE.MeshPhongMaterial({
      emissive: 0x222222,
      shininess: 100
    });
    
    const atomsMesh = new THREE.InstancedMesh(
      sphereGeometry,
      material,
      renderedAtoms
    );

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(25, 25, 25);
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();

    let instanceIndex = 0;
    const skipInterval = Math.round(1 / (1 - rejectionRate));
    
    for (let i = 0; i < totalAtoms; i++) {
      if (i % skipInterval === 0) continue;
      if (instanceIndex >= renderedAtoms) break;

      position.set(
        positions.getX(i) * 75,
        positions.getY(i) * 75,
        positions.getZ(i) * 75
      );

      matrix.compose(position, quaternion, scale);
      atomsMesh.setMatrixAt(instanceIndex, matrix);

      color.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i));
      atomsMesh.setColorAt(instanceIndex, color);

      instanceIndex++;
    }

    atomsMesh.instanceMatrix.needsUpdate = true;
    if (atomsMesh.instanceColor) {
      atomsMesh.instanceColor.needsUpdate = true;
    }

    // Create a group for the protein
    const proteinGroup = new THREE.Group();
    proteinGroup.add(atomsMesh);
    proteinGroup.scale.set(0.0002, 0.0002, 0.0002);
    proteinGroup.rotation.x -= Math.PI / 2;
    proteinGroup.position.y += 10;
    
    this.scene.add(proteinGroup);
    this.protein = proteinGroup;
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Rotate protein slowly
    if (this.protein) {
      this.protein.rotation.y += 0.0005;
    }

    // Always render, even if protein isn't loaded
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
  }
}

export default RYR1Viewer;
