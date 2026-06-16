// T&C.js

document.addEventListener('DOMContentLoaded', () => {

  // ==================== Header Scroll State ====================
  const header = document.getElementById('siteHeader');
  const progressBar = document.getElementById('progressBar');
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;

    // Progress bar
    if (progressBar) {
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      progressBar.style.width = scrollHeight > 0 ? ((y / scrollHeight) * 100) + '%' : '0%';
    }

    // Header scroll class
    if (header) {
      if (y > 50) header.classList.add('is-scrolled');
      else header.classList.remove('is-scrolled');
    }

    // Back to top button
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
      if (y > 300) backToTopBtn.classList.add('show');
      else backToTopBtn.classList.remove('show');
    }

    // Active sidebar link
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.sidebar ul li a');
    let current = '';
    sections.forEach(section => {
      if (y >= section.offsetTop - 220) current = section.id;
    });
    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href') || '';
      if (current && href.includes(current)) link.classList.add('active');
    });

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });


  // ==================== Mobile Drawer ====================
  const hamburgerBtn  = document.getElementById('hamburgerBtn');
  const mobileDrawer  = document.getElementById('mobileDrawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerClose   = document.getElementById('drawerClose');

  function openDrawer() {
    if (!mobileDrawer || !drawerOverlay || !hamburgerBtn) return;
    mobileDrawer.classList.add('is-open');
    drawerOverlay.classList.add('is-open');
    hamburgerBtn.classList.add('is-active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (!mobileDrawer || !drawerOverlay || !hamburgerBtn) return;
    mobileDrawer.classList.remove('is-open');
    drawerOverlay.classList.remove('is-open');
    hamburgerBtn.classList.remove('is-active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (hamburgerBtn)  hamburgerBtn.addEventListener('click', openDrawer);
  if (drawerClose)   drawerClose.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDrawer();
  });


  // ==================== FAQ Smooth Accordion ====================
  const faqItems = document.querySelectorAll('.faq');
  faqItems.forEach(faq => {
    const question = faq.querySelector('.faq-question');
    const answer   = faq.querySelector('.faq-answer');
    if (!question || !answer) return;

    // Prepare for smooth height animation
    answer.style.display    = 'block';
    answer.style.overflow   = 'hidden';
    answer.style.maxHeight  = '0';
    answer.style.padding    = '0 18px';
    answer.style.transition = 'max-height 0.38s ease, padding 0.38s ease';

    question.addEventListener('click', () => {
      const isOpen = faq.classList.contains('is-open');

      // Close all others
      faqItems.forEach(f => {
        if (f === faq) return;
        f.classList.remove('is-open');
        const a = f.querySelector('.faq-answer');
        const q = f.querySelector('.faq-question');
        if (a) { a.style.maxHeight = '0'; a.style.padding = '0 18px'; }
        if (q) q.setAttribute('aria-expanded', 'false');
      });

      if (isOpen) {
        faq.classList.remove('is-open');
        answer.style.maxHeight = '0';
        answer.style.padding   = '0 18px';
        question.setAttribute('aria-expanded', 'false');
      } else {
        faq.classList.add('is-open');
        answer.style.maxHeight = answer.scrollHeight + 40 + 'px';
        answer.style.padding   = '18px';
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });


  // ==================== Back to Top ====================
  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }


  // ==================== Newsletter Form ====================
  const newsletterForm    = document.getElementById('newsletterForm');
  const newsletterInput   = document.querySelector('.newsletter-input');
  const newsletterMessage = document.getElementById('newsletterMessage');
  const emailRegex        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showMessage(msg, type) {
    if (!newsletterMessage) return;
    newsletterMessage.textContent = msg;
    newsletterMessage.className   = type;
  }

  if (newsletterForm && newsletterInput) {
    newsletterForm.addEventListener('submit', e => {
      e.preventDefault();
      const email = newsletterInput.value.trim();
      if (!email) { showMessage('Please enter your email address.', 'error'); return; }
      if (!emailRegex.test(email)) { showMessage('Please enter a valid email address.', 'error'); return; }

      const btn = newsletterForm.querySelector('.newsletter-btn');
      if (btn) {
        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
        setTimeout(() => {
          showMessage('Successfully subscribed! Thank you.', 'success');
          newsletterInput.value = '';
          btn.disabled  = false;
          btn.innerHTML = orig;
        }, 1500);
      }
    });

    newsletterInput.addEventListener('focus', function () {
      if (this.parentElement) this.parentElement.style.boxShadow = '0 0 0 2px rgba(15, 76, 129, 0.2)';
    });
    newsletterInput.addEventListener('blur', function () {
      if (this.parentElement) this.parentElement.style.boxShadow = 'none';
    });
  }


  // ==================== Smooth Scroll for Hash Links ====================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#' || href === '') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });


  // ==================== Dynamic Copyright Year ====================
  const copyrightEl = document.querySelector('.copyright p');
  if (copyrightEl) {
    copyrightEl.textContent = `© ${new Date().getFullYear()} Fair Ford Pharmaceuticals Pvt. Ltd. All rights reserved.`;
  }


  // ==================== Scroll Reveal Animations ====================
  if ('IntersectionObserver' in window) {
    const revealEls = document.querySelectorAll('.card, .contact-box, .faq, .cta-section');
    const observer  = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    revealEls.forEach(el => {
      el.classList.add('reveal');
      observer.observe(el);
    });
  }

});
