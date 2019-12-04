// THREE
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import dat from 'dat.gui';

// Classes
require('./Utils/Stats');

// Constants
global.THREE = THREE;
const CAMERA_POSITIONS = {
    first_look: {
        x: 10.7,
        y: 169.50,
        z: 1071
    },
    free_view: {
        x: -974,
        y: 347,
        z: 398,
        duration: 3
    },
    dimensions: {
        x: 1070,
        y: 170,
        z: -40,
        duration: 5
    },
    aerodynamics: {
        x: 847,
        y: 436,
        z: 517,
        duration: 5
    },
    front_lighting: {
        x: -5.5,
        y: 170,
        z: 1071,
        duration: 5
    },
    rear_lighting: {
        x: 29,
        y: 170,
        z: -1071,
        duration: 5
    },
    wheel_steering: {
        x: 635,
        y: 170,
        z: -862,
        duration: 5
    },
}

class WebGL {
    constructor(_options) {
        // variables
        this.$canvas = _options.canvas;
        this.proccess = document.getElementById("progressbar_thumb")
        this.lights = [];
        this.content = null;
        this.carObjects = [];
        this.currentControl = null;

        // state
        this.state = {
            carLoaded: false,
            wheelsCanRotate: false,
            wheelSpeed: 0.05,
            addLights: true,
            envMapIntensity: 1,
            emissiveIntensity: 3,
            refractionRatio: 0,
            metalness: 0.5,
            roughness: 0,
            exposure: 0.7,
            textureEncoding: 'sRGB',
            steerDirection: ""
        };

        this.prevTime = 0;

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        const fov = 60;
        this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.01, 1000);
        this.camera.setFocalLength(this.camera.getFocalLength() + 10);
        this.scene.add(this.camera);

        // Renderer
        this.renderer = window.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: this.$canvas });
        this.renderer.physicallyCorrectLights = true;
        this.renderer.gammaOutput = true;
        this.renderer.gammaFactor = 2.2;
        this.renderer.setClearColor(0xcccccc);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enabled = false;
        this.controls.autoRotate = false;
        this.controls.enablePan = false;
        this.controls.enableKeys = false;
        this.controls.enableDamping = true;
        this.controls.screenSpacePanning = true;
        this.controls.maxPolarAngle = 0.9 * Math.PI / 2;
        this.controls.dampingFactor = 0.05;

        // Background
        this.background = new THREE.CubeTextureLoader()
            .setPath("environment/envSky/")
            .load([
                'px.jpg',
                'nx.jpg',
                'py.jpg',
                'ny.jpg',
                'pz.jpg',
                'nz.jpg'
            ]);
        this.scene.background = this.background;

        // Animate
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Resize listener
        window.addEventListener('resize', this.resize.bind(this), false);

        // Start Loading
        this.load();

        // Listen for controls
        this.setControlsListener();
    }
    animate(time) {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.render();
        if (this.carObjects.length) {
            this.rotateWheels();
        }

        // console.log(`Camera position x: ${this.camera.position.x} - y: ${this.camera.position.y} - z: ${this.camera.position.z}`)

        this.prevTime = time;
    }
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    resize() {
        const width = window.innerWidth, height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);

    }
    load() {
        // Draco
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('draco/')
        dracoLoader.setDecoderConfig({ type: 'js' })

        // GLTF
        const gltfLoader = new GLTFLoader()
        gltfLoader.setDRACOLoader(dracoLoader)
        gltfLoader.setCrossOrigin('anonymous')

        const file = "corolla.glb";
        gltfLoader.load(file, (gltf) => {

            const scene = gltf.scene || gltf.scenes[0];
            this.setContent(scene);

        }, (xhr) => {
            var percent = (xhr.loaded / xhr.total * 100);
            this.proccess.style.width = `${percent}%`;
        }, (error) => {
            console.error("Error: ", error)
        });

    }
    setContent(object) {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        object.position.x = 0 // += (object.position.x - center.x);
        object.position.y = 0 // += (object.position.y - center.y);
        object.position.z = 0 // += (object.position.z - center.z);

        this.controls.minDistance = size / 1.5;
        this.controls.maxDistance = size * 1;

        this.camera.near = size / 100;
        this.camera.far = size * 100;
        this.camera.updateProjectionMatrix();

        const { x, y, z } = CAMERA_POSITIONS.first_look;
        this.camera.position.set(x, y, z);
        this.camera.lookAt(center);

        this.scene.add(object);
        this.content = object;

        // this.initPlane();
        this.initiShadow(size);
        this.addLights();
        this.updateEnvironment();

        // set car objects
        this.state.carLoaded = true;
        this.setCarObjects();

        // Animate car position
        this.updateCameraPositon(CAMERA_POSITIONS.free_view, {
            delay: 1
        });

        // remove loading bar
        setTimeout(() => {
            document.getElementById("preload_screen").style.display = "none";
        }, 500)

        window.content = this.content;
        console.info('[glTF Loader] THREE.Scene exported as `window.content`.');
        this.addGUI();

    }
    initPlane() {
        const texture = new THREE.TextureLoader().load("ground-map.jpg");
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);

        const planeMaterial = new THREE.MeshLambertMaterial({ map: texture });
        const planeGeometry = new THREE.PlaneBufferGeometry(2000, 2000);

        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.y = this.content.position.y - 175;
        plane.rotation.x = - Math.PI / 2;
        plane.receiveShadow = true;

        this.scene.add(plane);
    }
    initiShadow(size) {
        // Texture
        const shadowTexture = new THREE.TextureLoader().load("shadow.jpg");

        // Plane
        const shadowPlane = new THREE.PlaneBufferGeometry(size*1.1, size * 1.1);
        shadowPlane.rotateX(-Math.PI / 2);
        shadowPlane.translate(1.56, 0, 0);

        // Material
        const shadowMaterial = new THREE.MeshBasicMaterial({
            map: shadowTexture,
            blending: THREE.MultiplyBlending,
            transparent: true,
        });

        // Mesh
        const shadowMesh = new THREE.Mesh(shadowPlane, shadowMaterial);
        shadowMesh.position.y = this.content.position.y - 180;
        shadowMesh.position.z = this.content.position.z + 80;
        shadowMesh.rotation.y = Math.PI / 2;
        this.scene.add(shadowMesh)
    }
    updateLights() {
        const lights = this.lights;

        if (lights.length) {
            this.removeLights();
            this.addLights();
        } else {
            this.addLights();
        }

        this.renderer.toneMappingExposure = this.state.exposure;
    }
    addLights() {
        // light 1
        const light1 = new THREE.AmbientLight(0xFFFFFF, 1);
        light1.name = 'ambient_light_1';
        this.camera.add(light1);

        // light 3
        const light2 = new THREE.AmbientLight(0xFFFFFF, 0.5);
        light2.name = 'ambient_light_2';
        this.camera.add(light2);

        // light 3
        const light3 = new THREE.AmbientLight(0xFFFFFF, 0.3);
        light3.name = 'ambient_light_3';
        this.camera.add(light3);

        // light 4
        // const light4 = new THREE.DirectionalLight(0xFFFFFF, 0.2);
        // light4.position.set(0, 1, 1);
        // light4.name = 'directional_light';
        // this.camera.add(light4);

        // light 3
        // const light3 = new THREE.SpotLight(0xFFFFFF, 2.00, 0, 0.400);
        // light3.position.set(0, 1000, 0);
        // light3.name = "top_light";
        // light3.castShadow = true;
        // this.scene.add(light3)

        // const spotLightHelper = new THREE.SpotLightHelper(light3);
        // this.scene.add(spotLightHelper);

        this.lights.push(light1, light2, light3);
    }
    removeLights() {
        this.lights.forEach((light) => light.parent.remove(light));
        this.lights.length = 0;
    }
    updateEnvironment() {
        const ignore = [
            "lastic",
            "dakhele_mashin"
        ];
        this.getCubeMapTexture().then(({ envMap }) => {
            this.traverseMaterials(this.content, (material) => {
                const name = material.name.toLowerCase();
                const isGlass = name.includes("shishe");
                if (!ignore.some(v => name.indexOf(v) >= 0)) {
                    material.envMap = envMap;
                    material.envMapIntensity = this.state.envMapIntensity;
                    material.emissiveIntensity = this.state.emissiveIntensity;
                    material.refractionRatio = this.state.refractionRatio;
                    // material.metalness = isGlass ? 0.01 : this.state.metalness;
                    material.metalness = this.state.metalness;
                    material.roughness = this.state.roughness;
                    material.needsUpdate = true;
                }
                if(name === "lastic"){
                    material.envMap = envMap;
                    material.metalness = 0.1;
                    material.roughness = 0.5;
                    material.needsUpdate = true;
                }
                if(material.name === "Dakhel_mashin"){
                    material.envMap = envMap;
                    material.metalness = 0;
                    material.roughness = 0.5;
                    material.needsUpdate = true;
                }
                // if (material.isMeshStandardMaterial || material.isGLTFSpecularGlossinessMaterial) {}
            });
        });
        this.updateTextureEncoding();
    }
    getCubeMapTexture() {
        return new Promise((resolve) => {
            const envMap = new THREE.CubeTextureLoader()
                .setPath("environment/envReflection/")
                .load([
                    'px.jpg',
                    'nx.jpg',
                    'py.jpg',
                    'ny.jpg',
                    'pz.jpg',
                    'nz.jpg'
                ]);
            envMap.format = THREE.RGBFormat;
            resolve({ envMap, cubeMap: envMap })
        })
    }
    updateTextureEncoding() {
        // const encoding = this.state.textureEncoding === 'sRGB' ? THREE.sRGBEncoding : THREE.LinearEncoding;
        const encoding = THREE.sRGBEncoding;
        this.traverseMaterials(this.content, (material) => {
            if (material.map) material.map.encoding = encoding;
            if (material.emissiveMap) material.emissiveMap.encoding = encoding;
            if (material.map || material.emissiveMap) material.needsUpdate = true;
        });
    }
    updateCameraPositon(position, _options) {
        const { x, y, z, duration = 2 } = position;
        const gsap = require("gsap").gsap;

        gsap.to(this.camera.position, {
            x,
            y,
            z,
            duration,
            ease: "expo.out",
            onStart: () => {
                if (this.controls.enabled) {
                    this.controls.enabled = false;
                    this.controls.update();
                }
            },
            onComplete: () => {
                this.camera.updateProjectionMatrix();
                if (!this.controls.enabled) {
                    this.controls.enabled = true;
                    this.controls.update();
                }
            },
            ..._options
        })
    }
    setCarObjects() {
        [
            "WheelBR",
            "WheelBL",
            "WheelFR",
            "WheelFL",
            "Cheagh_jelo",
            "lastik"
        ].map((name) => {
            this.content.traverse((node) => (node.name === name || node.name.toLowerCase().includes(name) && node.name !== "lastik_saghf") && this.carObjects.push(node));
        })
    }
    setControlsListener() {
        // Controls
        document.getElementsByClassName("user_control_1")[0].addEventListener("click", () => this.setCurrentControl(1), false);
        document.getElementsByClassName("user_control_2")[0].addEventListener("click", () => this.setCurrentControl(2), false);
        document.getElementsByClassName("user_control_3")[0].addEventListener("click", () => this.setCurrentControl(3), false);
        document.getElementsByClassName("user_control_4")[0].addEventListener("click", () => this.setCurrentControl(4), false);
        document.getElementsByClassName("user_control_5")[0].addEventListener("click", () => this.setCurrentControl(5), false);
        document.getElementsByClassName("user_control_6")[0].addEventListener("click", () => this.setCurrentControl(6), false);

        // Steering controls
        document.getElementById("steer_left").addEventListener("click", () => this.turnSteering("left"))
        document.getElementById("steer_right").addEventListener("click", () => this.turnSteering("right"))
    }
    setCurrentControl(controlNumber) {
        // remove active class from current control
        const query = document.querySelector(".controls ul li.active");
        query.classList.remove("active");

        // add new active control
        document.getElementsByClassName(`user_control_${controlNumber}`)[0].classList.add("active");

        // set control and run animation
        switch (controlNumber) {
            case 1:
                this.currentControl = 1
                this.updateCameraPositon(CAMERA_POSITIONS.dimensions);
                removeSteeringVisibility()
                this.turnSteering("center");
                this.floatedBpx("aerodynamics", "hide")
                this.floatedBpx("dimensions", "show")
                break;
            case 2:
                this.currentControl = 2
                this.updateCameraPositon(CAMERA_POSITIONS.aerodynamics);
                removeSteeringVisibility()
                this.turnSteering("center")
                this.floatedBpx("dimensions", "hide")
                this.floatedBpx("aerodynamics", "show")
                break;
            case 3:
                this.currentControl = 3
                this.updateCameraPositon(CAMERA_POSITIONS.front_lighting);
                removeSteeringVisibility()
                this.turnSteering("center")
                this.floatedBpx("dimensions", "hide")
                this.floatedBpx("aerodynamics", "hide")
                break;
            case 4:
                this.currentControl = 4
                this.updateCameraPositon(CAMERA_POSITIONS.rear_lighting);
                removeSteeringVisibility()
                this.turnSteering("center")
                this.floatedBpx("dimensions", "hide")
                this.floatedBpx("aerodynamics", "hide")
                break;
            case 5:
                this.currentControl = 5
                this.updateCameraPositon(CAMERA_POSITIONS.wheel_steering);
                steeringVisibility()
                this.floatedBpx("dimensions", "hide")
                this.floatedBpx("aerodynamics", "hide")
                break;
            case 6:
                this.currentControl = 6
                this.updateCameraPositon(CAMERA_POSITIONS.free_view);
                removeSteeringVisibility()
                this.turnSteering("center")
                this.floatedBpx("dimensions", "hide")
                this.floatedBpx("aerodynamics", "hide")
                break;
            default:
                // back to free view again
                this.currentControl = 6
                this.updateCameraPositon(CAMERA_POSITIONS.free_view);
                removeSteeringVisibility()
                this.turnSteering("center")
                this.floatedBpx("dimensions", "hide")
                this.floatedBpx("aerodynamics", "hide")
                break;
        }

        function removeSteeringVisibility() {
            document.getElementsByClassName("steering-control")[0].classList.remove("visible");
        }
        function steeringVisibility() {
            document.getElementsByClassName("steering-control")[0].classList.add("visible");
        }
    }
    turnSteering(direction) {
        const gsap = require("gsap").gsap;

        if (!this.carObjects.length) return;

        const wheelFL = this.carObjects.filter((object) => object.name === "WheelFL")[0];
        const wheelFR = this.carObjects.filter((object) => object.name === "WheelFR")[0];
        const wheelBL = this.carObjects.filter((object) => object.name === "WheelBL")[0];
        const wheelBR = this.carObjects.filter((object) => object.name === "WheelBR")[0];

        function removeRotation() {
            gsap.to(wheelFL.rotation, {
                y: 0
            })
            gsap.to(wheelFR.rotation, {
                y: 0
            })
            gsap.to(wheelBL.rotation, {
                y: 0
            })
            gsap.to(wheelBR.rotation, {
                y: 0
            })
        }

        switch (direction) {
            case "left":
                if (this.state.steerDirection === "left") {
                    removeRotation()
                    this.state.steerDirection = "";
                } else {
                    gsap.to(wheelFL.rotation, {
                        y: -0.5
                    })
                    gsap.to(wheelFR.rotation, {
                        y: -0.5
                    })
                    gsap.to(wheelBL.rotation, {
                        y: -0.1
                    })
                    gsap.to(wheelBR.rotation, {
                        y: -0.1
                    })
                    this.state.steerDirection = "left";
                }
                break;
            case "right":
                if (this.state.steerDirection === "right") {
                    removeRotation()
                    this.state.steerDirection = "";
                } else {
                    gsap.to(wheelFL.rotation, {
                        y: 0.5
                    })
                    gsap.to(wheelFR.rotation, {
                        y: 0.5
                    })
                    gsap.to(wheelBL.rotation, {
                        y: 0.1
                    })
                    gsap.to(wheelBR.rotation, {
                        y: 0.1
                    })
                    this.state.steerDirection = "right";
                }
                break;
            case "center":
                removeRotation()
                this.state.steerDirection = "";
                break;
            default:
                break;
        }
    }
    floatedBpx(name, status) {
        const dimensions_box = document.getElementById("dimensions_box");
        const aerodynamics_box = document.getElementById("aerodynamics_box");

        switch (name) {
            case "dimensions":
                if (status === "show") {
                    dimensions_box.style.opacity = "1";
                    dimensions_box.style.pointerEvents = "all";
                } else {
                    dimensions_box.style.opacity = "0";
                    dimensions_box.style.pointerEvents = "none";
                }
                break;
            case "aerodynamics":
                if (status === "show") {
                    aerodynamics_box.style.opacity = "1";
                    aerodynamics_box.style.pointerEvents = "all";
                } else {
                    aerodynamics_box.style.opacity = "0";
                    aerodynamics_box.style.pointerEvents = "none";
                }
                break;
            default:
                break;
        }
    }
    headFlares() {
        const cheagh_jelo = this.carObjects.filter((object) => object.name === "Cheagh_jelo")[0];
        const shishe = cheagh_jelo.children.filter((object) => object.name === "shishe")[0];
        shishe.emissive = 0xffffff;

        // RectAreaLightUniformsLib.init();
        // const rectLight = new THREE.RectAreaLight(0xffffff, 3, 10, 10);
        // rectLight.position.set( shishe.position );
        // rectLight.name = "cheragh_jelo_light";
        // shishe.add(rectLight)
        // this.scene.add(rectLight);


    }
    rotateWheels() {
        const lasti1 = this.carObjects.filter((object) => object.name === "Lastik")[0];
        const lasti2 = this.carObjects.filter((object) => object.name === "Lastik001")[0];
        const lasti3 = this.carObjects.filter((object) => object.name === "Lastik002")[0];
        const lasti4 = this.carObjects.filter((object) => object.name === "Lastik003")[0];

        lasti1.rotation.x += this.state.wheelSpeed;
        lasti2.rotation.x += this.state.wheelSpeed;
        lasti3.rotation.x += this.state.wheelSpeed;
        lasti4.rotation.x += this.state.wheelSpeed;
    }
    addGUI() {
        const gui = new dat.GUI();

        // Emissive
        const emissiveFolter = gui.addFolder("Emissive");
        const emissiveIntensity = emissiveFolter.add(this.state, "emissiveIntensity", 0, 5)
        emissiveIntensity.onChange(() => this.updateEnvironment())

        const envMapIntensity = emissiveFolter.add(this.state, "envMapIntensity", 0, 5);
        envMapIntensity.onChange(() => this.updateEnvironment())

        const refractionRatio = emissiveFolter.add(this.state, "refractionRatio", 0, 1);
        refractionRatio.onChange(() => this.updateEnvironment())

        const metalness = emissiveFolter.add(this.state, "metalness", 0, 1);
        metalness.onChange(() => this.updateEnvironment());

        const roughness = emissiveFolter.add(this.state, "roughness", 0, 1);
        roughness.onChange(() => this.updateEnvironment());

        // Lights
        const lightsFolder = gui.addFolder("Lights");
        const exposure = lightsFolder.add(this.state, "exposure", 0, 2);
        exposure.onChange(() => this.updateLights())

        // Wheels
        // const wheelsFolder = gui.addFolder("Wheels");
        // const wheelSpeed = wheelsFolder.add(this.state, "wheelSpeed", 0, 1);
        // wheelSpeed.onChange(() => this.rotateWheels())
    }
    traverseMaterials(object, callback) {
        object.traverse((node) => {
            if (!node.isMesh) return;
            const materials = Array.isArray(node.material)
                ? node.material
                : [node.material];
            materials.forEach(callback);
        });
    }
}

window.application = new WebGL({
    canvas: document.getElementsByClassName("canvas")[0]
});