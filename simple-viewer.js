import * as THREE from './lib/three/three.module.js';
import { PDBLoader } from './lib/three/examples/jsm/loaders/PDBLoader.js';

class SimpleViewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.proteinGroup = null;
    this.scrollRotation = 0;
    this.ticking = false;
    
    // Interactive controls
    this.isInteractive = false;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.manualRotation = { x: -Math.PI / 2, y: 0 };
    this.targetZoom = 120;
    this.currentZoom = 120;

    this.init();
    this.loadProtein();
    this.animate();
  }

  init() {
    // Get canvas dimensions
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Detect mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Scene with gradient background
    this.scene = new THREE.Scene();
    // Create gradient effect
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 2);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#f0f0f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 2);
    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;

    // Camera - positioned similar to original repo
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    this.camera.position.set(0, 50, 120);
    this.camera.lookAt(0, 0, 0);

    // Renderer - optimized for mobile
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: !isMobile,
      precision: isMobile ? 'mediump' : 'highp'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(100, 100, 100);
    this.scene.add(directionalLight);

    // Create protein group
    this.proteinGroup = new THREE.Group();
    this.scene.add(this.proteinGroup);

    // Add a subtle rotating placeholder while loading
    this.addLoadingPlaceholder();

    // Handle window resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    // Handle scroll with passive listener and requestAnimationFrame throttling
    window.addEventListener('scroll', () => {
      if (!this.ticking) {
        window.requestAnimationFrame(() => {
          this.scrollRotation = window.scrollY * 0.001;
          this.ticking = false;
        });
        this.ticking = true;
      }
    }, { passive: true });
    
    // Setup interactive controls
    this.setupInteractiveControls();
  }
  
  setupInteractiveControls() {
    // Mouse controls
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.isInteractive) return;
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isInteractive || !this.isDragging) return;
      
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;
      
      this.manualRotation.y -= deltaX * 0.005;
      this.manualRotation.x += deltaY * 0.005;
      
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
    });
    
    // Touch controls
    let lastTouchDistance = 0;
    
    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.isInteractive) return;
      
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.previousMousePosition = { 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        };
      } else if (e.touches.length === 2) {
        // Pinch to zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: true });
    
    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isInteractive) return;
      
      if (e.touches.length === 1 && this.isDragging) {
        const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
        const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
        
        this.manualRotation.y -= deltaX * 0.005;
        this.manualRotation.x += deltaY * 0.005;
        
        this.previousMousePosition = { 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        };
      } else if (e.touches.length === 2) {
        // Pinch to zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (lastTouchDistance > 0) {
          const delta = distance - lastTouchDistance;
          this.targetZoom -= delta * 0.5;
          this.targetZoom = Math.max(50, Math.min(300, this.targetZoom));
        }
        
        lastTouchDistance = distance;
      }
    }, { passive: true });
    
    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      lastTouchDistance = 0;
    }, { passive: true });
    
    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.isInteractive) return;
      
      e.preventDefault();
      this.targetZoom -= e.deltaY * 0.1;
      this.targetZoom = Math.max(50, Math.min(300, this.targetZoom));
    }, { passive: false });
  }
  
  enableInteractiveMode() {
    this.isInteractive = true;
    this.manualRotation = { 
      x: this.proteinGroup.rotation.x, 
      y: this.proteinGroup.rotation.z 
    };
    
    // If placeholder is still visible, sync its rotation and make it more prominent
    if (this.placeholder) {
      this.manualRotation.x = this.placeholder.rotation.x;
      this.manualRotation.y = this.placeholder.rotation.y;
      this.placeholder.material.opacity = 0.5;
      this.placeholder.scale.set(1.2, 1.2, 1.2);
    }
    
    this.canvas.style.cursor = 'grab';
  }
  
  disableInteractiveMode() {
    this.isInteractive = false;
    this.isDragging = false;
    this.targetZoom = 120;
    this.canvas.style.cursor = 'default';
    
    // Reset placeholder appearance
    if (this.placeholder) {
      this.placeholder.material.opacity = 0.3;
      this.placeholder.scale.set(1, 1, 1);
    }
  }

  addLoadingPlaceholder() {
    // Add a simple geometric shape while protein loads
    const geometry = new THREE.IcosahedronGeometry(40, 2);
    const material = new THREE.MeshPhongMaterial({ 
      color: 0xd94f6a,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });
    this.placeholder = new THREE.Mesh(geometry, material);
    this.placeholder.position.set(0, 30, 0);
    this.scene.add(this.placeholder);
  }

  loadProtein() {
    const loader = new PDBLoader();
    loader.load(
      './assets/8X48.pdb',
      (pdb) => this.onProteinLoaded(pdb),
      (xhr) => {
        const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
        console.log(`Loading protein: ${percent}%`);
      },
      (error) => console.error('Error loading protein:', error)
    );
  }

  onProteinLoaded(pdb) {
    const geometryAtoms = pdb.geometryAtoms;
    const json = pdb.json;

    // Remove loading placeholder
    if (this.placeholder) {
      this.scene.remove(this.placeholder);
      this.placeholder.geometry.dispose();
      this.placeholder.material.dispose();
      this.placeholder = null;
    }

    // Center the protein
    geometryAtoms.computeBoundingBox();
    const offset = new THREE.Vector3();
    geometryAtoms.boundingBox.getCenter(offset).negate();
    geometryAtoms.translate(offset.x, offset.y, offset.z);

    // Render atoms with instanced mesh (20% rejection for performance)
    this.renderAtomsInstanced(geometryAtoms);
    
    console.log(`Protein loaded: ${json.atoms.length} atoms`);
  }

  renderAtomsInstanced(geometryAtoms) {
    const positions = geometryAtoms.getAttribute('position');
    const colors = geometryAtoms.getAttribute('color');
    const totalAtoms = positions.count;
    
    // Detect mobile for rejection rate
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const rejectionRate = isMobile ? 0.8 : 0.6; // Skip 80% on mobile, 60% on desktop
    const renderedAtoms = Math.floor(totalAtoms * (1 - rejectionRate));

    // Use IcosahedronGeometry for atoms
    const atomGeometry = new THREE.IcosahedronGeometry(1, isMobile ? 0 : 1);
    const atomMaterial = new THREE.MeshPhongMaterial({
      shininess: 100,
      emissive: 0x111111
    });
    
    const atomsMesh = new THREE.InstancedMesh(
      atomGeometry,
      atomMaterial,
      renderedAtoms
    );

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(50, 50, 50);  // Larger atom scale
    const quaternion = new THREE.Quaternion();
    const color = new THREE.Color();

    let instanceIndex = 0;
    const skipInterval = Math.round(1 / (1 - rejectionRate));
    
    for (let i = 0; i < totalAtoms && instanceIndex < renderedAtoms; i++) {
      if (i % skipInterval !== 0) continue;

      position.set(
        positions.getX(i) * 75,
        positions.getY(i) * 75,
        positions.getZ(i) * 75
      );

      matrix.compose(position, quaternion, scale);
      atomsMesh.setMatrixAt(instanceIndex, matrix);

      color.setRGB(
        Math.max(0.3, colors.getX(i)),
        Math.max(0.3, colors.getY(i)),
        Math.max(0.3, colors.getZ(i))
      );
      atomsMesh.setColorAt(instanceIndex, color);

      instanceIndex++;
    }

    atomsMesh.instanceMatrix.needsUpdate = true;
    atomsMesh.instanceColor.needsUpdate = true;

    // Position and scale protein group
    this.proteinGroup.add(atomsMesh);
    this.proteinGroup.scale.set(0.006, 0.006, 0.006);
    this.proteinGroup.rotation.x = -Math.PI / 2;
    this.proteinGroup.position.set(0, 30, 0);
    
    console.log(`Rendered ${instanceIndex} atoms using InstancedMesh (${totalAtoms} total)`);
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    
    if (this.isInteractive) {
      // Interactive mode: use manual rotation from mouse/touch
      this.proteinGroup.rotation.x = this.manualRotation.x;
      this.proteinGroup.rotation.z = this.manualRotation.y;
      
      // If placeholder is still visible, make it interactive too
      if (this.placeholder) {
        this.placeholder.rotation.x = this.manualRotation.x;
        this.placeholder.rotation.y = this.manualRotation.y;
      }
      
      // Smooth zoom
      this.currentZoom += (this.targetZoom - this.currentZoom) * 0.1;
      this.camera.position.z = this.currentZoom;
      
      // Update cursor based on drag state
      this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
    } else {
      // Auto-rotate placeholder while loading
      if (this.placeholder) {
        this.placeholder.rotation.y += 0.01;
        this.placeholder.rotation.x += 0.005;
      }
      
      // Scroll-based rotation (default behavior)
      this.proteinGroup.rotation.x += (this.scrollRotation - this.proteinGroup.rotation.x) * 0.1;
      this.proteinGroup.rotation.z += (this.scrollRotation * 0.5 - this.proteinGroup.rotation.z) * 0.1;
      
      // Reset zoom when not interactive
      this.currentZoom += (120 - this.currentZoom) * 0.1;
      this.camera.position.z = this.currentZoom;
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}

export default SimpleViewer;
