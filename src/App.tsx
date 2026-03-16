import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Globe from 'react-globe.gl'
import * as THREE from 'three'

const ThinkingWebGL = ({ imageUrl }: { imageUrl: string }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(800, 600)
    containerRef.current.appendChild(renderer.domElement)

    const geometry = new THREE.PlaneGeometry(2, 2)
    const loader = new THREE.TextureLoader()
    const texture = loader.load(imageUrl)
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          // Subtly animate the UVs for a "thinking" liquid effect
          uv.x += sin(uv.y * 10.0 + uTime * 0.5) * 0.01;
          uv.y += cos(uv.x * 10.0 + uTime * 0.5) * 0.01;
          
          vec4 color = texture2D(uTexture, uv);
          gl_FragColor = color;
        }
      `,
      transparent: true
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    let animationId: number
    const animate = (time: number) => {
      material.uniforms.uTime.value = time * 0.001
      renderer.render(scene, camera)
      animationId = requestAnimationFrame(animate)
    }
    animate(0)

    return () => {
      cancelAnimationFrame(animationId)
      renderer.dispose()
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [imageUrl])

  return <div ref={containerRef} style={{ width: '800px', height: '600px', margin: '0 auto', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }} />
}

const SystemSpectrumWebGL = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const width = containerRef.current.clientWidth || 1000
    const height = 500

    // Scene Setup
    const scene = new THREE.Scene()
    // Using Orthographic camera to prevent perspective distortion (ovals at edges)
    const aspect = width / height
    const viewSize = 10
    const camera = new THREE.OrthographicCamera(
      -viewSize * aspect / 2, 
      viewSize * aspect / 2, 
      viewSize / 2, 
      -viewSize / 2, 
      0.1, 
      1000
    )
    camera.position.z = 10

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: "high-performance" 
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    containerRef.current.appendChild(renderer.domElement)

    // Colors
    const colorS1 = new THREE.Color('#C05C23') // Burnt Orange
    const colorS2 = new THREE.Color('#FDF19E') // Pale Yellow

    // 1. Particle Background
    const particleCount = 2000
    const pGeometry = new THREE.BufferGeometry()
    const pPositions = new Float32Array(particleCount * 3)
    const pColors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 16
      const y = (Math.random() - 0.5) * 8
      const z = (Math.random() - 0.5) * 2
      
      pPositions[i * 3] = x
      pPositions[i * 3 + 1] = y
      pPositions[i * 3 + 2] = z
      
      const t = (x + 8) / 16
      const mixColor = new THREE.Color().copy(colorS1).lerp(colorS2, t)
      pColors[i * 3] = mixColor.r
      pColors[i * 3 + 1] = mixColor.g
      pColors[i * 3 + 2] = mixColor.b
    }

    pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3))
    pGeometry.setAttribute('color', new THREE.BufferAttribute(pColors, 3))
    const pMaterial = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.4 })
    const particleSystem = new THREE.Points(pGeometry, pMaterial)
    scene.add(particleSystem)

    // 2. Neurons
    const neuronCount = 45
    const neuronPositions: THREE.Vector3[] = []
    const neuronGroup = new THREE.Group()

    for (let i = 0; i < neuronCount; i++) {
      const x = ((i / (neuronCount - 1)) - 0.5) * 14
      const pos = new THREE.Vector3(
        x,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 1
      )
      neuronPositions.push(pos)

      const geo = new THREE.SphereGeometry(0.08, 16, 16)
      const mat = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color().copy(colorS1).lerp(colorS2, (x + 7) / 14),
        transparent: true,
        opacity: 0.8
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(pos)
      neuronGroup.add(mesh)
    }
    scene.add(neuronGroup)

    // Synapse Lines
    const synapseMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 })
    neuronPositions.forEach((p1, i) => {
      neuronPositions.forEach((p2, j) => {
        if (i < j && p1.distanceTo(p2) < 2.5) {
          const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2])
          const line = new THREE.Line(lineGeo, synapseMaterial)
          scene.add(line)
        }
      })
    })

    // 3. Firing Pulses
    const pulses: { mesh: THREE.Mesh, curve: THREE.LineCurve3, speed: number, t: number }[] = []
    const createPulse = () => {
      const startIdx = Math.floor(Math.random() * neuronCount)
      let endIdx = Math.floor(Math.random() * neuronCount)
      while (neuronPositions[startIdx].distanceTo(neuronPositions[endIdx]) > 3 || startIdx === endIdx) {
        endIdx = Math.floor(Math.random() * neuronCount)
      }

      const curve = new THREE.LineCurve3(neuronPositions[startIdx], neuronPositions[endIdx])
      const pGeo = new THREE.SphereGeometry(0.03, 8, 8)
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const pMesh = new THREE.Mesh(pGeo, pMat)
      scene.add(pMesh)
      pulses.push({ mesh: pMesh, curve, speed: 0.01 + Math.random() * 0.02, t: 0 })
    }

    // Animation Loop
    const animate = (time: number) => {
      const elapsed = time * 0.001

      // Animate Background Particles
      const positions = pGeometry.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        const x = positions[i * 3]
        const chaos = (1 - (x + 6) / 12) * 0.5 // S1 is more chaotic
        positions[i * 3 + 1] += Math.sin(elapsed + x) * 0.005 * chaos
      }
      pGeometry.attributes.position.needsUpdate = true

      // Create new pulses
      if (Math.random() > 0.9) createPulse()

      // Animate Pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.t += p.speed
        p.mesh.position.copy(p.curve.getPoint(p.t))
        if (p.t >= 1) {
          scene.remove(p.mesh)
          p.mesh.geometry.dispose()
          ;(p.mesh.material as THREE.Material).dispose()
          pulses.splice(i, 1)
        }
      }

      // Gentle rotation of the whole neural network
      neuronGroup.rotation.y = Math.sin(elapsed * 0.2) * 0.1

      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)

    // Cleanup
    return () => {
      renderer.dispose()
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px', cursor: 'crosshair' }}>
      <div ref={containerRef} />
      
      {/* Overlay UI */}
      <div style={{ position: 'absolute', top: '30px', left: '40px', color: '#C05C23', textShadow: '0 0 20px rgba(192, 92, 35, 0.5)' }}>
        <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '2px' }}>SYSTEM 1</div>
        <div style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6 }}>INTUITIVE / FAST</div>
      </div>

      <div style={{ position: 'absolute', top: '30px', right: '40px', color: '#FDF19E', textAlign: 'right', textShadow: '0 0 20px rgba(253, 241, 158, 0.5)' }}>
        <div style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '2px' }}>SYSTEM 2</div>
        <div style={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.6 }}>ANALYTICAL / SLOW</div>
      </div>

      <div style={{ 
        position: 'absolute', 
        bottom: '30px', 
        left: '50%', 
        transform: 'translateX(-50%)', 
        display: 'flex', 
        gap: '40px',
        background: 'rgba(0,0,0,0.3)',
        padding: '10px 30px',
        borderRadius: '100px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        {['GOALS', 'CONTEXT', 'MEMORY', 'EMOTION', 'FEEDBACK'].map(label => (
          <span key={label} style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
        ))}
      </div>
    </div>
  )
}

interface SlideItem {
  label?: string | React.ReactNode;
  title?: string;
  desc: string | React.ReactNode;
}

interface Facilitator {
  name: string;
  role: string;
  image: string;
}

interface TableRow {
  country: string;
  agree: string;
  notSure?: string;
  disagree: string;
}

interface Slide {
  id: number;
  type: 'title' | 'facilitators' | 'story' | 'intro' | 'image-only' | 'webgl-image' | 'system-spectrum' | 'question' | 'analysis' | 'grid' | 'sprint-header' | 'framework' | 'comparison' | 'table' | 'workshop';
  title?: string;
  subtitle?: string;
  tag?: string;
  text?: string;
  icon?: string;
  image?: string;
  images?: string[];
  items?: SlideItem[];
  facilitators?: Facilitator[];
  case?: string;
  situation?: string | React.ReactNode;
  task?: string | React.ReactNode;
  questions?: string[];
  rows?: TableRow[];
  sprint?: string;
  question?: string;
}

const basePath = '/smarter-together'

const slides: Slide[] = [
  { id: 1, type: 'title', title: 'SMARTER TOGETHER', subtitle: 'SXSW 2026', tag: 'HOW WE THINK, FEEL, AND DECIDE WITH AI' },
  { id: 2, type: 'facilitators', title: 'Meet the Facilitators', facilitators: [
    { name: 'Michael Joffe', role: 'NYU, Psychology & AI | Marketing, Google', image: `${basePath}/avatars/Joffe headshot.jpeg` },
    { name: 'Manuel Garcia-Garcia Phd', role: 'Global Science Lead, Ipsos', image: `${basePath}/avatars/Manuel headshot.jpeg` }
  ]},
  { id: 3, type: 'intro', title: 'The Problem', text: 'Avoiding the Next Chicken Nugget Apocalypse', tag: 'SMARTER TOGETHER 2026', icon: '🍗' },
  { id: 4, type: 'image-only', image: `${basePath}/Mcdonalds 1.png` },
  { id: 5, type: 'image-only', image: `${basePath}/Mcdonalds 2.png` },
  { id: 6, type: 'analysis', title: 'WHAT ACTUALLY HAPPENED?', subtitle: 'A Disconnect Between Design and Psychology', items: [
    { label: 'The Failure', desc: 'A design failure extending beyond the code into user experience.' },
    { label: 'The Violation', desc: 'The system violated the fundamental need for Control and Correction.' },
    { label: 'The Illusion', desc: 'The system confidently presented incorrect choices, forcing the user to absorb the consequences.' },
    { label: 'The Fix', desc: 'Proactively offering Confidence Indicators or an easy "Exit Ramp".' }
  ]},
  { id: 7, type: 'grid', title: 'THE RISKS OF GETTING IT WRONG', subtitle: 'The Four Horsemen of Bad AI', items: [
    { title: '1. Agency Erosion', desc: 'We stop choosing and start accepting. The AI standardizes our choices.' },
    { title: '2. Over-Trust', desc: 'We hand over the keys too early, assuming the "Magic" is real.' },
    { title: '3. Trust Breakdowns', desc: 'One failure destroys confidence permanently (Algorithm Aversion).' },
    { title: '4. Cultural Incongruence', desc: 'The AI fails to "read the room" (Tone/Context), offending the user.' }
  ]},
  { id: 8, type: 'sprint-header', sprint: '01', title: 'Decision Making', subtitle: 'From Automation to Augmentation: Designing for Better Decisions' },
  { id: 9, type: 'question', question: '“What decisions would you fully delegate AI? Which decisions would you never delegate to AI? Why?”' },
  { id: 10, type: 'image-only', images: [`${basePath}/phiineas 1.jpg`, `${basePath}/Phineas 2.jpg`] },
  { id: 11, type: 'image-only', image: `${basePath}/Muhammad-Yunus.jpg` },
  { id: 12, type: 'system-spectrum', title: 'The Spectrum of Thought', subtitle: 'Between Intuition and Deliberation' },
  { id: 13, type: 'analysis', title: 'SMARTER TOGETHER 2026', subtitle: 'The Cost of Seamless Automation', items: [
    { label: 'Friction as a Feature', desc: 'Well-designed human–AI systems introduce positive cognitive friction at the right moments to slow down thinking and improve judgment.' },
    { label: 'Cognitive Conflict', desc: 'When people encounter conflicting signals or uncertainty, the brain slows automatic processing and recruits deliberative reasoning.' },
    { label: 'Design Strategy', desc: 'Low-stakes tasks → minimize friction. High-stakes decisions → introduce productive friction.' }
  ]},
  { id: 14, type: 'framework', title: 'When to Hand the Keys Back', subtitle: 'Adapted from Amershi et al., 2019', items: [
    { label: 'Initially', desc: 'Make it clear what the system can do and how it can do it.' },
    { label: 'During', desc: 'Show contextually relevant information relevant to the user’s current task.' },
    { label: 'When Wrong', desc: 'Enable the user to access an explanation of why the system behaved as it did.' }
  ]},
  { id: 15, type: 'workshop', title: 'Decision Making Sprint', case: 'Patient Triage Product', situation: 'A design team working on a product that supports healthcare workers with patient discharge. Pilot trial: 94% success, reduced patient stays by 18%. Hospital administrators want a full launch, but senior doctors fear the tool will remove their agency and lead to patient harm.', task: 'Design one feature that augments doctor decision making rather than overriding it. Describe the feature and your rollout strategy.', questions: ['Who are the stakeholders? What do they care about?', 'What risks and cognitive biases (e.g. over-reliance) are involved?', 'In what conditions should the physician override? How would you design for this?'] },
  { id: 16, type: 'sprint-header', sprint: '02', title: 'Emotion', subtitle: 'Designing for Human Emotional Context' },
  { id: 17, type: 'question', question: '“Can AI Be Emotionally Intelligent?”' },
  { id: 18, type: 'image-only', image: `${basePath}/Ibn Sina.jpg` },
  { id: 19, type: 'story', title: '1,000 Years Ago', text: '1,000 years ago, Ibn Sina diagnosed "lovesickness" by monitoring a pulse while reciting village names.', tag: 'EMOTION AI ORIGINS', image: `${basePath}/avatars/Ibn Sina.jpg` },
  { id: 20, type: 'analysis', title: 'Beyond "Happy" and "Sad"', subtitle: 'The 3D Spectrum (VAC Model)', items: [
    { label: 'Valence', desc: 'Positive vs. Negative experience.' },
    { label: 'Arousal', desc: 'Intensity: High Energy vs. Low Energy.' },
    { label: 'Control', desc: 'Hierarchy: Dominance vs. Submission.' }
  ]},
  { id: 21, type: 'grid', title: 'Multimodal AI', subtitle: 'Combining Signals for Accuracy', items: [
    { title: 'Face', desc: 'Micro-expressions (CNNs)' },
    { title: 'Voice', desc: 'Prosody (Pitch, Tone, Speed)' },
    { title: 'Body', desc: 'Posture, HRV and Skin Conductance' }
  ]},
  { id: 22, type: 'analysis', title: 'SMARTER TOGETHER 2026', subtitle: 'The Empathy Gap', items: [
    { label: 'Simulation vs. Comprehension', desc: 'AI detects patterns, not feelings. It has no subjective experience. It simulates empathy without comprehension.' },
    { label: 'Theory of Mind', desc: 'AI struggles to model why you feel a certain way or understand false beliefs (The Sally-Anne Test).' }
  ]},
  { id: 23, type: 'framework', title: 'Emotional Design', subtitle: 'Don Norman Framework', items: [
    { label: 'Visceral', desc: 'Does it look friendly and inviting?' },
    { label: 'Behavioral', desc: 'Does it respond appropriately to user input?' },
    { label: 'Reflective', desc: 'How does the user feel after the interaction?' }
  ]},
  { id: 24, type: 'workshop', title: 'Emotional Design Sprint', case: 'Personal Wellness Coach', situation: 'You are on the product team for a new AI-powered mobile app designed to be a “mindfulness coach” for young adults dealing with everyday stress and anxiety. The app provides guided meditations, journaling prompts, and cognitive behavioral therapy (CBT) exercises.', task: 'Create the Persona: Brainstorm a core personality for the app’s AI assistant. Give it a name, choose an archetype (e.g. “The Guide”, “The Companion”), and list three defining adjectives. Then, design an emotional interaction for a user who is struggling with motivation.', questions: ['Emotional Diagnosis: How to interpret the users’ emotional responses?', 'Empathy Layer: How to make the user feel recognized in a human-like manner?', 'Guardrail Layer: What are the risks of emotional intelligence and how to build guardrails?'] },
  { id: 25, type: 'sprint-header', sprint: '03', title: 'Trust', subtitle: 'Building Reliable & Meaningful Connections' },
  { id: 26, type: 'image-only', image: `${basePath}/Air canada.jpg` },
  { id: 27, type: 'story', title: 'The Air Canada Lesson', text: 'In Moffatt v. Air Canada, the court rejected the idea of an "independent" bot.', tag: 'TRUST & AUTOMATION' },
  { id: 28, type: 'grid', title: 'Trust is Efficient Prediction', subtitle: 'Types of Trust', items: [
    { title: 'Contractual Trust', desc: 'Reliability and rules. A logical calculation of performance and consistent behavior over time.' },
    { title: 'Interpersonal Trust', desc: 'Emotion and relationship. We mistakenly anthropomorphize reliable systems.' },
    { title: 'Trust (The User)', desc: 'Trust is situated with the user. It is a psychological state and willingness to be vulnerable.' },
    { title: 'Trustworthiness (The AI)', desc: 'A characteristic of the system itself. Its actual ability to perform reliably and safely.' }
  ]},
  { id: 29, type: 'grid', title: 'WE TREAT AI AS A SOCIAL ACTOR', subtitle: 'We Treat AI as a Social Actor', items: [
    { title: 'CASA', desc: 'Computers are Social Actors. We apply human social rules to tech automatically.' },
    { title: 'Anthropomorphism', desc: 'We project intent and personality onto systems that show "competence" or "care".' },
    { title: 'Cognitive Fluency', desc: 'Natural language and "human-like" responses bypass our logical skepticism.' },
    { title: 'Neurobiology', desc: 'Our brains process digital social cues using the same pathways as human interaction.' }
  ]},
  { id: 30, type: 'framework', title: 'THE MICROMOMENTS OF TRUST', subtitle: 'Building Confidence Across the User Journey', items: [
    { label: 'Upfront', desc: 'Make it clear what the system can do and how it can do it.' },
    { label: 'During', desc: 'Explaining decisions and offering appropriate context.' },
    { label: 'Overtime', desc: 'Learn from behavior and provide global controls for the user.' }
  ]},
  { id: 31, type: 'analysis', title: 'Why We Reject Superior Help', subtitle: 'Algorithm Aversion', items: [
    { label: 'The Conflict', desc: 'Doctors paired with AI often perform worse than AI alone.' },
    { label: 'The Breakdown', desc: 'We lose confidence in algorithms faster than humans after a single error.' },
    { label: 'The Fix', desc: 'Trust Calibration: Designing for appropriate levels of reliance.' }
  ]},
  { id: 32, type: 'workshop', title: 'Trust Design Sprint', case: 'AI Robo Advisor', situation: <>An AI-powered “robo-advisor” analyzes the market and gives users investment recommendations. Consider two different users:<br /><br /><b>User A (The Skeptic):</b> An experienced investor who ignores the AI’s data-driven advice to sell a declining stock, trusting their “gut feeling.” (Algorithm Aversion).<br /><br /><b>User B (The Believer):</b> A novice investor who accepts the AI’s advice to put their life savings into a high-risk fund without a second thought (Over-reliance).</>, task: 'Design a "Calibration" Intervention: Propose one transparent, agency-respecting AI feature for both users (e.g., An "Explain the Risk" button showing the recommendation, confidence, data, and a critical prompt).', questions: ['Diagnose Psychological Risk: State each user\'s main psychological risk in one sentence.', 'Calibration & Outcome: How does the feature help the skeptic accept data while encouraging the believer to think critically?'] },
  { id: 33, type: 'sprint-header', sprint: '04', title: 'Culture', subtitle: 'Accounting for Global Context' },
  { id: 34, type: 'comparison', title: 'The Stories We Tell', subtitle: 'Cultural Narratives of AI', items: [
    { label: 'The West (Terminator)', desc: 'AI is an apocalyptic threat. A "cold, Germanic cyborg" to be feared.' },
    { label: 'The East (Transformers)', desc: 'AI is a helper, a protector, a soulful companion (Animism).' }
  ]},
  { id: 35, type: 'framework', title: 'Who Are You Building For?', subtitle: 'Is AI WEIRD?', items: [
    { label: '88% Non-WEIRD', desc: 'The vast majority of data comes from Western, Educated, Industrialized, Rich contexts.' },
    { label: 'Value Bias', desc: 'LLMs exhibit values resembling "English-speaking Protestant Europe".' },
    { label: 'Cultural Fit', desc: 'Safety gaps: AI trained on Western norms fails in local contexts.' }
  ]},
  { id: 36, type: 'comparison', title: 'When Silence Speaks', subtitle: 'Edward Hall Framework', items: [
    { label: 'Low Context (US/Germany)', desc: 'Meaning is explicit. "Say what you mean."' },
    { label: 'High Context (Japan/LatAm)', desc: 'Meaning is implicit. Tone, gesture, and silence carry the weight.' }
  ]},
  { id: 37, type: 'table', title: 'Global Excitement Split', subtitle: 'Ipsos AI Monitor, 2025: "Products and services using AI make me excited"', rows: [
    { country: 'Indonesia', agree: '80%', notSure: '4%', disagree: '16%' },
    { country: 'Thailand', agree: '79%', notSure: '7%', disagree: '14%' },
    { country: 'Malaysia', agree: '77%', notSure: '6%', disagree: '17%' },
    { country: 'South Korea', agree: '69%', notSure: '4%', disagree: '27%' },
    { country: 'Türkiye', agree: '67%', notSure: '9%', disagree: '24%' },
    { country: 'Singapore', agree: '67%', notSure: '6%', disagree: '27%' },
    { country: 'Peru', agree: '66%', notSure: '7%', disagree: '27%' },
    { country: 'Mexico', agree: '65%', notSure: '6%', disagree: '29%' },
    { country: 'India', agree: '65%', notSure: '9%', disagree: '26%' },
    { country: 'South Africa', agree: '61%', notSure: '8%', disagree: '31%' },
    { country: 'Colombia', agree: '60%', notSure: '8%', disagree: '32%' },
    { country: 'Brazil', agree: '57%', notSure: '14%', disagree: '29%' },
    { country: 'Chile', agree: '53%', notSure: '6%', disagree: '41%' },
    { country: 'Poland', agree: '49%', notSure: '10%', disagree: '41%' },
    { country: 'Italy', agree: '49%', notSure: '9%', disagree: '42%' },
    { country: 'Japan', agree: '46%', notSure: '14%', disagree: '40%' },
    { country: 'Spain', agree: '45%', notSure: '11%', disagree: '44%' },
    { country: 'Germany', agree: '45%', notSure: '10%', disagree: '45%' },
    { country: 'Hungary', agree: '44%', notSure: '7%', disagree: '49%' },
    { country: 'Switzerland', agree: '44%', notSure: '6%', disagree: '50%' },
    { country: 'Argentina', agree: '43%',  notSure: '13%', disagree: '44%' },
    { country: 'Ireland', agree: '41%', notSure: '9%', disagree: '50%' },
    { country: 'Australia', agree: '40%', notSure: '8%', disagree: '52%' },
    { country: 'France', agree: '40%', notSure: '9%', disagree: '51%' },
    { country: 'Netherlands', agree: '39%', notSure: '6%', disagree: '55%' },
    { country: 'USA', agree: '38%', notSure: '9%', disagree: '53%' },
    { country: 'Great Britain', agree: '37%', notSure: '10%', disagree: '53%' },
    { country: 'Sweden', agree: '34%', notSure: '10%', disagree: '56%' },
    { country: 'Belgium', agree: '32%', notSure: '9%', disagree: '59%' },
    { country: 'Canada', agree: '31%', notSure: '11%', disagree: '58%' }
  ]},
  { id: 38, type: 'workshop', title: 'Culture Sprint', case: 'Global Productivity App', situation: <>A California-based tech company has launched a popular AI productivity app in the United States. Its success was driven by features that gamify individual performance and track personal metrics. However, a recent launch in Japan is failing – users try it once and then quickly churn.</>, task: <><b>The Challenge:</b> Use cultural frameworks (Hofstede/Hall) to diagnose the failure and redesign the experience for the Japanese market.</>, questions: ['Hypothesis: Why is the US success failing in Japan? (Consider collectivism vs. individualism).', 'Stakeholders: Identify 3 Japanese groups needed to test this (e.g. evaluating managers vs. tenured employees).', 'Killer Question: What single strategic question must your research answer to guide a redesign?'] },
  { id: 39, type: 'title', title: 'THANK YOU', subtitle: 'Continue the Conversation', tag: 'WWW.SMARTERTOGETHERAI.COM' }
]

export default function App() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [scale, setScale] = useState(1)
  const [countriesData, setCountriesData] = useState({ features: [] })
  const slide = slides[currentSlide]

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1))
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0))

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(setCountriesData)
      .catch(err => console.error("Error fetching geojson", err))
  }, [])

  // Brand Colors
  const brandPrimary = '#C05C23' // Burnt Orange
  const brandSecondary = '#FDF19E' // Pale Yellow

  const getCountryColor = (name: string) => {
    const tableSlide = slides.find(s => s.type === 'table') as any;
    const row = tableSlide?.rows?.find((r: any) => 
      r.country.toLowerCase() === name.toLowerCase() || 
      (r.country === 'USA' && name === 'United States of America') ||
      (r.country === 'Great Britain' && name === 'United Kingdom') ||
      (r.country === 'Türkiye' && name === 'Turkey')
    );
    if (!row) return 'rgba(255,255,255,0.02)'; // Very subtle blank

    const agree = parseInt(row.agree.replace('%', ''));
    const notSure = parseInt(row.notSure?.replace('%', '') || '0');
    const score = agree + (notSure * 0.5);
    const t = Math.max(0, Math.min(1, (score - 35) / 50)); // Normalize 35-85 to 0-1
    
    // Interpolate from Burnt Orange to Pale Yellow
    const r = Math.round(192 + t * (253 - 192));
    const g = Math.round(92 + t * (241 - 92));
    const b = Math.round(35 + t * (158 - 35));
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const baseWidth = 1440
      const baseHeight = 900
      const scaleW = width / baseWidth
      const scaleH = height / baseHeight
      setScale(Math.min(scaleW, scaleH, 1))
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide()
      if (e.key === 'ArrowLeft') prevSlide()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const styles = {
    container: { minHeight: '100vh', width: '100vw', backgroundColor: '#0a0a0c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflowY: 'auto', overflowX: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' },
    inner: { width: '1000px', padding: '60px 0', zIndex: 10, transform: `scale(${scale})`, transformOrigin: 'center center' },
    tag: { fontSize: '12px', fontFamily: 'monospace', letterSpacing: '4px', color: brandPrimary, marginBottom: '30px', textTransform: 'uppercase', textAlign: 'center' },
    h1: { fontSize: 'clamp(3rem, 10vw, 8rem)', fontWeight: '900', lineHeight: '0.9', margin: '0', textTransform: 'uppercase', letterSpacing: '-4px', textAlign: 'center' },
    h2: { fontSize: 'clamp(2rem, 6vw, 4rem)', fontWeight: '800', marginBottom: '20px', letterSpacing: '-2px' },
    pill: { border: '1px solid rgba(255,255,255,0.1)', padding: '8px 20px', borderRadius: '100px', fontSize: '10px', letterSpacing: '2px', color: brandSecondary, display: 'inline-block', marginTop: '40px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', marginTop: '60px' },
    card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '40px', borderRadius: '24px' },
    nav: { position: 'absolute', bottom: '40px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    btn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '15px 30px', borderRadius: '100px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }
  }

  return (
    <div style={styles.container as any}>
      {/* Brand Color Glows */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'rgba(192, 92, 35, 0.15)', filter: 'blur(150px)', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'rgba(253, 241, 158, 0.05)', filter: 'blur(150px)', borderRadius: '50%' }} />

      {/* Full Screen Toggle */}
      <button 
        onClick={toggleFullScreen}
        style={{
          position: 'absolute',
          top: '30px',
          right: '30px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
          padding: '8px 15px',
          borderRadius: '100px',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          zIndex: 100,
          opacity: 0,
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.color = brandSecondary;
          e.currentTarget.style.borderColor = brandSecondary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0';
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        }}
      >
        ⛶ Full Screen
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={styles.inner as any}
        >
          {slide.type === 'title' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.tag as any}>{slide.subtitle}</div>
            <h1 style={styles.h1 as any}>{slide.title}</h1>
            <div style={styles.pill as any}>{slide.tag}</div>
          </div>
        )}

        {slide.type === 'facilitators' && (
          <div>
            <div style={{ ...styles.tag, textAlign: 'left' } as any}>{slide.title}</div>
            <div style={styles.grid as any}>
              {slide.facilitators?.map((f) => (
                <div key={f.name} style={styles.card as any}>
                  <div style={{ marginBottom: '30px', width: '120px', height: '120px', borderRadius: '24px', overflow: 'hidden', border: `2px solid ${brandPrimary}` }}>
                    <img 
                      src={f.image} 
                      alt={f.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as any).style.display = 'none';
                        (e.target as any).parentElement.innerHTML = '<div style="font-size: 50px; display: flex; align-items: center; justify-content: center; height: 100%;">👤</div>';
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '10px' }}>{f.name}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>{f.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide.type === 'story' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '80px', marginBottom: '40px' }}>{slide.icon}</div>
            <h1 style={{ ...styles.h1, fontStyle: 'italic', fontSize: 'clamp(2rem, 6vw, 5.5rem)' } as any}>{slide.text}</h1>
            <div style={styles.pill as any}>{slide.tag}</div>
          </div>
        )}

        {slide.type === 'intro' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
              <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="nuggetGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="#E6A63E" />
                    <stop offset="100%" stopColor="#C05C23" />
                  </radialGradient>
                </defs>
                
                {/* Nuggets (Peeking out) */}
                <motion.path
                  animate={{ y: [0, -5, 0], rotate: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  d="M35,55 C35,35 55,30 70,35 C85,40 90,55 80,70 C70,85 40,90 35,70 Z"
                  fill="url(#nuggetGradient)"
                  stroke="#FDF19E"
                  strokeWidth="1"
                />
                <motion.path
                  animate={{ y: [0, -4, 0], rotate: [0, -1, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
                  d="M55,60 C55,40 75,35 90,40 C105,45 110,60 100,75 C90,90 60,95 55,75 Z"
                  fill="url(#nuggetGradient)"
                  stroke="#FDF19E"
                  strokeWidth="1"
                />

                {/* The Red Tray Holder */}
                <path
                  d="M30,50 L110,50 L100,110 L40,110 Z"
                  fill="#DA291C"
                  stroke="#8B0000"
                  strokeWidth="2"
                />
                
                {/* Tray front shadow/detail */}
                <path
                  d="M40,110 L100,110 L103,90 L37,90 Z"
                  fill="black"
                  opacity="0.1"
                />
              </svg>
            </div>
            <h1 style={{ ...styles.h1, fontStyle: 'italic', fontSize: 'clamp(2rem, 8vw, 6rem)' } as any}>{slide.text}</h1>
            <div style={styles.pill as any}>{slide.tag}</div>
          </div>
        )}

        {slide.type === 'image-only' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', gap: '30px' }}>
            {slide.images ? (
              slide.images.map((img, i) => (
                <div key={i} style={{ 
                  flex: 1, 
                  height: '600px', 
                  borderRadius: '48px', 
                  overflow: 'hidden', 
                  background: (slide.id === 4 || slide.id === 5 || slide.id === 17) ? '#fff' : 'transparent',
                  padding: (slide.id === 4 || slide.id === 5 || slide.id === 17) ? '40px' : '0'
                }}>
                  <img 
                    src={img} 
                    alt={`Slide content ${i}`} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: (slide.id === 4 || slide.id === 5 || slide.id === 17) ? 'contain' : 'cover' 
                    }}
                  />
                </div>
              ))
            ) : (
              <div style={{ 
                width: '100%', 
                height: '600px', 
                borderRadius: '48px', 
                overflow: 'hidden', 
                background: (slide.id === 4 || slide.id === 5 || slide.id === 17) ? '#fff' : 'transparent',
                padding: (slide.id === 4 || slide.id === 5 || slide.id === 17) ? '40px' : '0'
              }}>
                <img 
                  src={slide.image} 
                  alt="Slide content" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: (slide.id === 4 || slide.id === 5 || slide.id === 17) ? 'contain' : 'cover' 
                  }}
                />
              </div>
            )}
          </div>
        )}

        {slide.type === 'webgl-image' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <ThinkingWebGL imageUrl={slide.image || ''} />
          </div>
        )}

        {slide.type === 'system-spectrum' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ ...styles.tag, textAlign: 'left', marginBottom: '10px' } as any}>{slide.title}</div>
            <h2 style={{ ...styles.h2, fontSize: '2.5rem', marginBottom: '30px' } as any}>{slide.subtitle}</h2>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
              <SystemSpectrumWebGL />
            </div>
          </div>
        )}

        {slide.type === 'question' && (
          <div style={{ textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 5rem)', fontWeight: '800', lineHeight: '1.2' }}>{slide.question}</h2>
            <div style={{ height: '4px', width: '80px', background: brandPrimary, margin: '40px auto' }} />
          </div>
        )}

        {slide.type === 'analysis' && (
          <div>
            <div style={{ ...styles.tag, textAlign: 'left' } as any}>{slide.title}</div>
            <h2 style={styles.h2 as any}>{slide.subtitle}</h2>
            
            {/* Custom Interactive VAC Model Graphic for Slide 20 */}
            {slide.id === 20 ? (
              <div style={{ display: 'flex', gap: '40px', marginTop: '40px', alignItems: 'center' }}>
                <div style={{ flex: 1.2, position: 'relative', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="100%" height="100%" viewBox="0 0 500 500" style={{ overflow: 'visible' }}>
                    <defs>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    
                    {/* Grid Lines (Centered at 250,250) */}
                    <line x1="250" y1="250" x2="250" y2="100" stroke={brandPrimary} strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
                    <line x1="250" y1="250" x2="400" y2="250" stroke={brandPrimary} strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
                    <line x1="250" y1="250" x2="150" y2="350" stroke={brandPrimary} strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />

                    {/* Main Axes */}
                    <motion.line 
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5 }}
                      x1="250" y1="250" x2="250" y2="120" stroke={brandPrimary} strokeWidth="4" filter="url(#glow)"
                    />
                    <motion.line 
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.2 }}
                      x1="250" y1="250" x2="380" y2="250" stroke={brandSecondary} strokeWidth="4" filter="url(#glow)"
                    />
                    <motion.line 
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.4 }}
                      x1="250" y1="250" x2="170" y2="330" stroke={brandPrimary} strokeWidth="4" filter="url(#glow)"
                    />

                    {/* Axis Labels (Multi-line for clarity) */}
                    <text x="250" y="85" fill={brandPrimary} textAnchor="middle" fontSize="14" fontWeight="bold" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                      AROUSAL
                      <tspan x="250" dy="20" fontSize="11" opacity="0.6" fontWeight="normal">(High vs Low)</tspan>
                    </text>
                    
                    <text x="390" y="250" fill={brandSecondary} textAnchor="start" fontSize="14" fontWeight="bold" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                      VALENCE
                      <tspan x="390" dy="20" fontSize="11" opacity="0.6" fontWeight="normal">(Pos vs Neg)</tspan>
                    </text>
                    
                    <text x="160" y="345" fill={brandPrimary} textAnchor="end" fontSize="14" fontWeight="bold" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                      CONTROL
                      <tspan x="160" dy="20" fontSize="11" opacity="0.6" fontWeight="normal">(Dom vs Sub)</tspan>
                    </text>

                    {/* Floating Data Points */}
                    <motion.circle 
                      animate={{ y: [0, -15, 0], x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 4 }}
                      cx="300" cy="180" r="10" fill={brandSecondary} opacity="0.7" filter="url(#glow)" 
                    />
                    <motion.circle 
                      animate={{ y: [0, 15, 0], x: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 5 }}
                      cx="210" cy="280" r="7" fill={brandPrimary} opacity="0.5" filter="url(#glow)"
                    />
                  </svg>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                   {slide.items?.map((item: any) => (
                    <div key={item.label} style={{ ...styles.card, borderLeft: `4px solid ${brandPrimary}`, padding: '25px 35px' } as any}>
                      <div style={{ fontWeight: '700', fontSize: '20px', marginBottom: '8px', color: brandSecondary }}>{item.label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ ...styles.grid, gridTemplateColumns: (slide.id === 13 || slide.id === 29 || slide.id === 30 || slide.id === 31) ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(450px, 1fr))' } as any}>
                {slide.items?.map((item: any) => (
                  <div key={item.label} style={{ ...styles.card, display: 'flex', gap: '30px', minWidth: 0 } as any}>
                    <div style={{ fontWeight: '900', color: brandPrimary, fontSize: '18px' }}>+</div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '20px', marginBottom: '8px' }}>{item.label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {slide.type === 'grid' && (
          <div>
            <div style={{ ...styles.tag, textAlign: 'left' } as any}>{slide.title}</div>
            <h2 style={styles.h2 as any}>{slide.subtitle}</h2>
            {slide.id === 28 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '40px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                  {slide.items?.slice(0, 2).map((item: any) => (
                    <div key={item.title} style={styles.card as any}>
                      <div style={{ fontWeight: '800', fontSize: '22px', marginBottom: '15px', color: brandPrimary }}>{item.title}</div>
                      <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: `1px solid ${brandSecondary}33`, 
                  borderRadius: '24px', 
                  padding: '40px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto 1fr',
                  alignItems: 'center',
                  gap: '40px'
                }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '22px', marginBottom: '15px', color: brandSecondary }}>{(slide.items?.[2] as any)?.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>{(slide.items?.[2] as any)?.desc}</div>
                  </div>
                  <div style={{ fontSize: '24px', opacity: 0.3 }}>⟷</div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '22px', marginBottom: '15px', color: brandSecondary }}>{(slide.items?.[3] as any)?.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>{(slide.items?.[3] as any)?.desc}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ ...styles.grid, gridTemplateColumns: slide.id === 21 ? 'repeat(3, 1fr)' : '1fr 1fr' } as any}>
                {slide.items?.map((item: any) => (
                  <div key={item.title} style={styles.card as any}>
                    <div style={{ fontWeight: '800', fontSize: '22px', marginBottom: '15px', color: brandPrimary }}>{item.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {slide.type === 'sprint-header' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', background: 'rgba(192, 92, 35, 0.1)', color: brandPrimary, padding: '10px 30px', borderRadius: '100px', fontFamily: 'monospace', letterSpacing: '4px', marginBottom: '40px', border: '1px solid rgba(192, 92, 35, 0.2)' }}>SPRINT {slide.sprint}</div>
            <h1 style={styles.h1 as any}>{slide.title}</h1>
            <p style={{ fontSize: '24px', color: brandSecondary, opacity: 0.8, marginTop: '30px', textTransform: 'uppercase', letterSpacing: '2px' }}>{slide.subtitle}</p>
          </div>
        )}

        {slide.type === 'framework' && (
          <div>
             <div style={{ ...styles.tag, textAlign: 'left' } as any}>{slide.title}</div>
             <h2 style={styles.h2 as any}>{slide.subtitle}</h2>
             <div style={{ display: 'flex', gap: '20px', marginTop: '60px' }}>
                {slide.items?.map((item: any, i) => (
                  <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '40px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: brandPrimary, marginBottom: '20px', opacity: 0.8 }}>0{i+1}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginBottom: '15px' }}>{item.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>{item.desc}</div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {slide.type === 'comparison' && (
          <div>
            <div style={{ ...styles.tag, textAlign: 'left' } as any}>{slide.title}</div>
            <h2 style={styles.h2 as any}>{slide.subtitle}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '60px' }}>
              {slide.items?.map((item: any, i) => (
                <div key={i} style={{ ...styles.card, background: i === 0 ? 'rgba(192, 92, 35, 0.05)' : 'rgba(253, 241, 158, 0.05)' } as any}>
                  <div style={{ fontSize: '32px', fontWeight: '900', marginBottom: '20px', color: i === 0 ? brandPrimary : brandSecondary }}>{item.label}</div>
                  <p style={{ fontSize: '20px', lineHeight: '1.6', color: 'rgba(255,255,255,0.7)' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide.type === 'table' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ ...styles.tag, textAlign: 'left', marginBottom: '10px' } as any}>{slide.title}</div>
            <h2 style={{ ...styles.h2, fontSize: '2.5rem', marginBottom: '10px' } as any}>{slide.subtitle}</h2>
            
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: brandSecondary, borderRadius: '2px' }}></div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>High Excitement</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: brandPrimary, borderRadius: '2px' }}></div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Low Excitement</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)' }}></div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>No Data</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '30px', height: '480px' }}>
              <div style={{ position: 'relative', height: '100%', borderRadius: '24px', overflow: 'hidden', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {countriesData.features?.length > 0 ? (
                  <Globe
                    width={720}
                    height={480}
                    backgroundColor="rgba(0,0,0,0)"
                    showAtmosphere={true}
                    atmosphereColor={brandPrimary}
                    atmosphereAltitude={0.15}
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-water.png"
                    polygonsData={countriesData.features}
                    polygonAltitude={d => {
                      const c = getCountryColor((d as any).properties.NAME);
                      return c === 'rgba(255,255,255,0.02)' ? 0.01 : 0.04;
                    }}
                    polygonCapColor={d => getCountryColor((d as any).properties.NAME)}
                    polygonSideColor={() => 'rgba(0, 0, 0, 0.4)'}
                    polygonStrokeColor={() => '#111'}
                    polygonLabel={(data: any) => {
                      const d = data.properties;
                      const row = (slide as any).rows?.find((r: TableRow) => 
                        r.country.toLowerCase() === d.NAME.toLowerCase() || 
                        (r.country === 'USA' && d.NAME === 'United States of America') ||
                        (r.country === 'Great Britain' && d.NAME === 'United Kingdom') ||
                        (r.country === 'Türkiye' && d.NAME === 'Turkey')
                      );
                      if (!row) return `<div style="background: rgba(0,0,0,0.8); padding: 5px 10px; border-radius: 4px;"><b>${d.NAME}</b><br/>No Data</div>`;
                      return `
                        <div style="background: rgba(0,0,0,0.8); padding: 10px; border-radius: 8px; border: 1px solid ${brandPrimary}; min-width: 140px;">
                          <b style="font-size: 14px; display: block; margin-bottom: 5px;">${row.country}</b>
                          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                            <span>Excited:</span>
                            <span style="color:${brandSecondary}; font-weight: bold;">${row.agree}</span>
                          </div>
                          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                            <span>Not Sure:</span>
                            <span style="color:white; font-weight: bold;">${row.notSure}</span>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span>Nervous:</span>
                            <span style="color:${brandPrimary}; font-weight: bold;">${row.disagree}</span>
                          </div>                        </div>
                      `;
                    }}
                    onPolygonHover={setHoverD => setHoverD}
                  />
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.5)' }}>Loading Globe...</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: brandSecondary, fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '12px' }}>THE EXCITEMENT GAP</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', opacity: 0.6 }}>Top Regions</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Asia & LatAm</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>Indonesia (80%), Thailand (79%)</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', opacity: 0.6 }}>Most Skeptical</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Western Nations</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>Canada (31%), Belgium (32%)</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '25px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ color: brandPrimary, fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '15px' }}>KEY INSIGHT</div>
                  <p style={{ fontSize: '15px', lineHeight: '1.6', margin: 0, opacity: 0.9 }}>
                    There is a clear <b>East-West divide</b>. Emerging economies see AI as a "leapfrog" opportunity for rapid growth, while developed markets focus more heavily on displacement and systemic risk.
                  </p>
                  <p style={{ fontSize: '14px', lineHeight: '1.6', marginTop: '15px', opacity: 0.7 }}>
                    This sentiment gap suggests that Western-centric "safety" frameworks may not align with the progress-first priorities of the Global South.
                  </p>
                  <div style={{ marginTop: 'auto', padding: '15px', background: 'rgba(192, 92, 35, 0.1)', borderRadius: '12px', border: '1px solid rgba(192, 92, 35, 0.2)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: brandPrimary }}>Regional Outlier</div>
                    <div style={{ fontSize: '13px', marginTop: '5px' }}>Japan (46%) is the only Asian nation in the bottom half of the list.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {slide.type === 'workshop' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px', marginBottom: '25px' }}>
              <div>
                <div style={{ ...styles.tag, textAlign: 'left', marginBottom: '5px' } as any}>{slide.title}</div>
                <h2 style={{ ...styles.h2, margin: 0, fontSize: '2.5rem' } as any}>{slide.case}</h2>
              </div>
              <div style={{ fontSize: '10px', color: brandSecondary, fontWeight: 'bold', letterSpacing: '1px' }}>WORKSHOP MODE</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '25px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ color: brandPrimary, fontWeight: 'bold', fontSize: '10px', marginBottom: '10px', letterSpacing: '2px' }}>SITUATION</div>
                <p style={{ fontSize: '15px', lineHeight: '1.5', marginBottom: '20px', color: 'rgba(255,255,255,0.8)' }}>{slide.situation}</p>
                <div style={{ color: brandSecondary, fontWeight: 'bold', fontSize: '10px', marginBottom: '10px', letterSpacing: '2px' }}>YOUR TASK</div>
                <p style={{ fontSize: '16px', fontWeight: 'bold', lineHeight: '1.5', margin: 0 }}>{slide.task}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {slide.questions?.map((q, i) => (
                   <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '18px 25px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                     <p style={{ margin: 0, opacity: 0.9, fontSize: '14px', lineHeight: '1.4' }}>{q}</p>
                   </div>
                ))}
              </div>
            </div>
          </div>
        )}                </motion.div>
              </AnimatePresence>
        
              <div style={styles.nav as any}>
        
        <div />
        <div style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', fontSize: '12px', letterSpacing: '2px' }}>
          SLIDE {currentSlide + 1} / {slides.length}
        </div>
      </div>
    </div>
  )
}
