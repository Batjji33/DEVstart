/* ============================================
   DEVstart — Main JavaScript
   Navigation, Scroll Reveal, Particles, Form
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Initialize Icons ----
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ---- Navbar Scroll Effect ----
  const navbar = document.querySelector('.navbar');
  const handleScroll = () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ---- Mobile Menu Toggle ----
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('open');
      document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ---- Active Nav Link ----
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html') || (currentPath === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // ---- Scroll Reveal (IntersectionObserver) ----
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${i * 0.08}s`;
      observer.observe(el);
    });
  }

  // ---- Particles Background ----
  const canvas = document.getElementById('particles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const PARTICLE_COUNT = 60;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.4 + 0.1;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > width) this.speedX *= -1;
        if (this.y < 0 || this.y > height) this.speedY *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 160, ${this.opacity})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle());
    }

    function connectParticles() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 229, 160, ${0.06 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      connectParticles();
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ---- Contact Form ----
  const form = document.getElementById('contact-form');
  const formSuccess = document.getElementById('form-success');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // ---- Honeypot anti-spam ----
      // Champ invisible (#company-website) : un humain ne le voit pas, donc le laisse vide.
      // Un bot le remplit automatiquement → on simule un succès sans rien envoyer.
      const honeypot = form.querySelector('#company-website');
      if (honeypot && honeypot.value.trim() !== '') {
        form.style.display = 'none';
        if (formSuccess) formSuccess.classList.add('show');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;

      // Basic validation
      const name = form.querySelector('#name').value.trim();
      const email = form.querySelector('#email').value.trim();
      const plan = form.querySelector('#plan').value;
      const projectType = form.querySelector('#project-type').value;
      const budget = form.querySelector('#budget').value;
      const message = form.querySelector('#message').value.trim();

      if (!name || !email || !message) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
      }

      // Email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert('Veuillez entrer une adresse email valide.');
        return;
      }

      // ---- reCAPTCHA v2 ----
      // On exige que la case « Je ne suis pas un robot » soit cochée.
      let recaptchaToken = '';
      if (typeof grecaptcha !== 'undefined') {
        recaptchaToken = grecaptcha.getResponse();
        if (!recaptchaToken) {
          alert('Veuillez cocher la case « Je ne suis pas un robot ».');
          return;
        }
      }

      // UI State: Loading
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Envoi en cours...';

      // EmailJS integration
      // Note: "service_id" and "template_id" are placeholders relative to your EmailJS account setup.
      const templateParams = {
        name: name,
        email: email,
        plan: plan || 'Non précisé',
        project_type: projectType || 'Non précisé',
        budget: budget || 'Non précisé',
        message: message,
        to_email: 'constantbataille@gmail.com',
        'g-recaptcha-response': recaptchaToken
      };

      if (typeof emailjs !== 'undefined') {
        // We pass the public key directly here too for better compatibility
        emailjs.send('service_1j40dia', 'template_8s44e3m', templateParams, 'pnjo9PySa8KcVpUOP')
          .then(() => {
            form.style.display = 'none';
            if (formSuccess) {
              formSuccess.classList.add('show');
            }
          })
          .catch((error) => {
            console.error('EmailJS Error:', error);
            const errorMsg = error?.text || error?.message || "Erreur inconnue";
            alert("Une erreur est survenue lors de l'envoi (" + errorMsg + "). Veuillez vérifier vos identifiants EmailJS ou nous contacter par mail directement.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            // On réinitialise le reCAPTCHA pour permettre une nouvelle tentative.
            if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
          });
      } else {
        // Fallback or demo mode
        console.log('Simulation d\'envoi d\'email (EmailJS non configuré):', templateParams);
        setTimeout(() => {
          form.style.display = 'none';
          if (formSuccess) formSuccess.classList.add('show');
        }, 1500);
      }
    });
  }

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---- Opening Hours Logic ----
  function initHours() {
    const hoursList = document.getElementById('hours-list');
    const statusBubble = document.getElementById('status-bubble');
    const periodInfo = document.getElementById('period-info');
    if (!hoursList || !statusBubble || !periodInfo) return;

    // Define Zone B vacation ranges (approximation for 2024-2026)
    const vacations = [
      { start: '2024-10-19', end: '2024-11-04' },
      { start: '2024-12-21', end: '2025-01-06' },
      { start: '2025-02-08', end: '2025-02-24' },
      { start: '2025-04-05', end: '2025-04-22' },
      { start: '2025-07-05', end: '2025-09-01' },
      { start: '2025-10-18', end: '2025-11-03' },
      { start: '2025-12-20', end: '2026-01-05' },
      { start: '2026-02-14', end: '2026-03-02' },
      { start: '2026-04-11', end: '2026-04-27' },
      { start: '2026-07-04', end: '2026-09-01' }
    ].map(v => ({ start: new Date(v.start), end: new Date(v.end) }));

    function getParisDate() {
      const now = new Date();
      const parisTime = now.toLocaleString("en-US", { timeZone: "Europe/Paris" });
      return new Date(parisTime);
    }

    const now = getParisDate();
    const isVacation = vacations.some(v => now >= v.start && now <= v.end);

    periodInfo.textContent = isVacation ? "Période de Vacances (Zone B)" : "Période Scolaire";

    const schedule = {
      scolaire: [
        { label: 'Lundi', blocks: [[18, 19]], text: '18h - 19h' },
        { label: 'Mardi', blocks: [[18, 19]], text: '18h - 19h' },
        { label: 'Mercredi', blocks: [[17, 19]], text: '17h - 19h' },
        { label: 'Jeudi', blocks: [[18, 19]], text: '18h - 19h' },
        { label: 'Vendredi', blocks: [], text: 'Fermé' },
        { label: 'Samedi', blocks: [[11, 12], [14, 18]], text: '11h - 12h / 14h - 18h' },
        { label: 'Dimanche', blocks: [[14, 18]], text: '14h - 18h' }
      ],
      vacances: [
        { label: 'Lundi', blocks: [[14, 19]], text: '14h - 19h' },
        { label: 'Mardi', blocks: [[11, 12], [14, 19]], text: '11h - 12h / 14h - 19h' },
        { label: 'Mercredi', blocks: [[11, 12], [14, 19]], text: '11h - 12h / 14h - 19h' },
        { label: 'Jeudi', blocks: [[11, 12], [14, 19]], text: '11h - 12h / 14h - 19h' },
        { label: 'Vendredi', blocks: [[11, 12], [14, 19]], text: '11h - 12h / 14h - 19h' },
        { label: 'Samedi', blocks: [[11, 12], [14, 19]], text: '11h - 12h / 14h - 19h' },
        { label: 'Dimanche', blocks: [[14, 18]], text: '14h - 18h' }
      ]
    };

    const activeSchedule = isVacation ? schedule.vacances : schedule.scolaire;
    const currentDayIndex = (now.getDay() + 6) % 7; // Lundi=0, Dimanche=6
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMins = currentHour * 60 + currentMinute;

    activeSchedule.forEach((day, index) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.padding = '4px 0';
      if (index === currentDayIndex) {
        li.style.color = 'var(--text-primary)';
        li.style.fontWeight = '600';
      }
      li.innerHTML = `<span>${day.label}</span> <span>${day.text}</span>`;
      hoursList.appendChild(li);
    });

    // Determine status
    const todayBlocks = activeSchedule[currentDayIndex].blocks;
    let status = 'fermé';

    // To properly calculate "ouvre bientôt", we might also need to check the next day if we are after closing? 
    // Usually it's just 'fermé' if it's past the last block. But let's keep it simple:

    for (const block of todayBlocks) {
      const openTime = block[0] * 60;
      const closeTime = block[1] * 60;

      if (currentTotalMins >= openTime && currentTotalMins < closeTime) {
        if (closeTime - currentTotalMins <= 30) {
          status = 'ferme-bientot';
        } else {
          status = 'ouvert';
        }
        break;
      } else if (openTime > currentTotalMins && openTime - currentTotalMins <= 30) {
        status = 'ouvre-bientot';
        break;
      }
    }

    if (status === 'ouvert') {
      statusBubble.innerHTML = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:currentColor; margin-right:6px; animation: pulse-dot 2s infinite;"></span>Ouvert';
      statusBubble.style.background = 'rgba(0, 229, 160, 0.15)';
      statusBubble.style.color = 'var(--accent)';
      statusBubble.style.border = '1px solid var(--accent)';
    } else if (status === 'fermé') {
      statusBubble.innerHTML = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:currentColor; margin-right:6px;"></span>Actuellement fermé';
      statusBubble.style.background = 'rgba(255, 60, 60, 0.1)';
      statusBubble.style.color = '#ff6b6b';
      statusBubble.style.border = '1px solid rgba(255, 107, 107, 0.5)';
    } else if (status === 'ouvre-bientot') {
      statusBubble.innerHTML = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:currentColor; margin-right:6px;"></span>Ouvre bientôt';
      statusBubble.style.background = 'rgba(255, 165, 0, 0.15)';
      statusBubble.style.color = '#ffa500';
      statusBubble.style.border = '1px solid rgba(255, 165, 0, 0.5)';
    } else if (status === 'ferme-bientot') {
      statusBubble.innerHTML = '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:currentColor; margin-right:6px;"></span>Ferme bientôt';
      statusBubble.style.background = 'rgba(255, 165, 0, 0.15)';
      statusBubble.style.color = '#ffa500';
      statusBubble.style.border = '1px solid rgba(255, 165, 0, 0.5)';
    }
  }

  initHours();

});
