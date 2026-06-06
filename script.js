/* script.js — Interactivity for portfolio
   - Smooth scrolling
   - Mobile nav toggle
   - Intersection Observer reveal animations
   - Animated counters
   - Project filtering
   - Preloader hide
   - Back-to-top and whatsapp button behavior
*/

document.addEventListener('DOMContentLoaded', () => {
  // Preloader
  const preloader = document.getElementById('preloader');
  setTimeout(()=>{preloader && (preloader.style.display = 'none')}, 700);

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if(navToggle){
    navToggle.addEventListener('click', ()=>{
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Smooth scrolling for internal links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if(href.length>1){
        e.preventDefault();
        const el = document.querySelector(href);
        if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
        // close mobile menu
        navLinks.classList.remove('open');
        if(navToggle) navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Reveal on scroll using Intersection Observer
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('show');
      }
    });
  },{threshold:0.15});
  reveals.forEach(r=>observer.observe(r));

  // Counters
  const counters = document.querySelectorAll('.stat[data-target], .counter, .stat .num');
  counters.forEach(c => {
    const parent = c.closest('.stat');
    let target = c.dataset.target || c.getAttribute('data-target') || c.textContent;
    target = Number(target) || Number(c.textContent) || 0;
    // create observer per counter
    const obs = new IntersectionObserver((entries, o)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          animateCount(c, target, 1600);
          o.unobserve(entry.target);
        }
      });
    },{threshold:0.5});
    obs.observe(c);
  });

  function animateCount(el, to, duration){
    const start = 0; const range = to - start; const startTime = performance.now();
    function step(now){
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.floor(progress * range + start);
      if(el.classList.contains('num')) el.textContent = value;
      else el.textContent = value;
      if(progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const projectCards = document.querySelectorAll('.project-card');
  projectCards.forEach(card => {
    const imageSrc = card.dataset.image;
    if(!imageSrc) return;
    card.addEventListener('click', () => {
      window.open(imageSrc, '_blank');
    });
  });

  // Back to top
  const back = document.getElementById('backToTop');
  window.addEventListener('scroll', ()=>{
    if(window.scrollY > 400) back.style.display = 'block'; else back.style.display = 'none';
  });
  back.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));

  // Dynamic year in footer
  const year = document.getElementById('year'); if(year) year.textContent = new Date().getFullYear();

  // Small a11y: allow keyboard toggle for nav
  if(navToggle){ navToggle.addEventListener('keydown', (e)=>{ if(e.key==='Enter') navLinks.classList.toggle('open'); }); }
});

// Review modal logic and Supabase-powered rating
document.addEventListener('DOMContentLoaded', ()=>{
  const openBtn = document.getElementById('openReview');
  const modal = document.getElementById('reviewModal');
  const closeBtn = document.getElementById('closeReview');
  const rating = document.getElementById('rating');
  const submit = document.getElementById('submitReview');
  const message = document.getElementById('reviewMessage');
  const loadMoreButton = document.getElementById('loadMoreReviews');
  let selectedRating = 0;
  let approvedReviews = [];
  const reviewsPerPage = 6;
  const paginationThreshold = 20;
  let currentReviewPage = 1;
  let useNumericPagination = false;

  function setModal(open){
    if(!modal) return;
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    modal.classList.toggle('visible', open);
  }

  if(openBtn) openBtn.addEventListener('click', ()=> setModal(true));
  if(closeBtn) closeBtn.addEventListener('click', ()=> setModal(false));
  if(modal) modal.addEventListener('click', (e)=>{ if(e.target===modal) setModal(false); });

  if(rating){
    rating.querySelectorAll('span').forEach(s=>{
      s.addEventListener('mouseover', ()=> highlight(Number(s.dataset.value)));
      s.addEventListener('click', ()=>{ selectedRating = Number(s.dataset.value); highlight(selectedRating); });
    });
    rating.addEventListener('mouseout', ()=> highlight(selectedRating));
  }

  function highlight(n){
    if(!rating) return;
    rating.querySelectorAll('span').forEach(s=>{
      const v = Number(s.dataset.value);
      s.classList.toggle('active', v <= n);
    });
  }

  function setMessage(text, type='success'){
    if(!message) return;
    message.textContent = text;
    message.className = `review-message ${type}`;
  }

  function clearForm(){
    const text = document.getElementById('reviewText');
    const name = document.getElementById('reviewName');
    if(text) text.value = '';
    if(name) name.value = '';
    selectedRating = 0;
    highlight(0);
  }

  if(submit){
    submit.addEventListener('click', async ()=>{
      const textInput = document.getElementById('reviewText');
      const nameInput = document.getElementById('reviewName');
      const reviewText = textInput?.value.trim() || '';
      const reviewName = nameInput?.value.trim() || 'Anonymous';
      if(!reviewText){ setMessage('Please write a review message before submitting.', 'error'); return; }
      if(selectedRating < 1){ setMessage('Please choose a star rating between 1 and 5.', 'error'); return; }

      submit.disabled = true;
      setMessage('Submitting your review...', 'info');

      try{
        const { error } = await supabaseClient.from('reviews').insert([{ 
          name: reviewName,
          rating: selectedRating,
          review: reviewText,
          approved: true
        }]);

        if(error){
          throw error;
        }

        setMessage('Thank you! Your review is now live on the portfolio.', 'success');
        clearForm();
        await loadApprovedReviews();
        setTimeout(()=> setModal(false), 900);
      }catch(err){
        console.error('Supabase review submit error', err);
        setMessage('Unable to submit your review at this time. Please try again later.', 'error');
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function loadApprovedReviews(){
    if (typeof supabaseClient === 'undefined') return;
    try{
      const { data, error } = await supabaseClient
        .from('reviews')
        .select('name,rating,review,created_at')
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if(error){
        console.error('Supabase review fetch error', error);
        return;
      }

      approvedReviews = data || [];
      console.log('Reviews fetched from Supabase:', approvedReviews);
      currentReviewPage = 1;
      useNumericPagination = approvedReviews.length > paginationThreshold;

      const avgEl = document.getElementById('avgRating');
      const countEl = document.getElementById('reviewCount');
      const averageRating = approvedReviews.length ? approvedReviews.reduce((total, item) => total + Number(item.rating || 0), 0) / approvedReviews.length : 0;
      if(avgEl){
        avgEl.textContent = approvedReviews.length ? `${averageRating.toFixed(1)} Average Rating` : 'No reviews yet';
      }
      if(countEl){
        countEl.textContent = approvedReviews.length ? `${approvedReviews.length} Customer Reviews` : 'Be the first customer to leave a review';
      }

      renderReviewsPage(currentReviewPage);
    }catch(err){
      console.error('Supabase review load failed', err);
    }
  }

  function getReviewsForPage(page){
    const start = (page - 1) * reviewsPerPage;
    return approvedReviews.slice(start, start + reviewsPerPage);
  }

  function renderReviewsPage(page, append = false){
    const grid = document.querySelector('.reviews-grid');
    const action = grid?.querySelector('.review-action');
    if(!grid || !action){
      console.warn('Reviews container or action button not found.');
      return;
    }

    if(!append){
      grid.querySelectorAll('.review-entry').forEach(n=>n.remove());
    }

    const pageReviews = useNumericPagination ? getReviewsForPage(page) : approvedReviews.slice(0, page * reviewsPerPage);
    if(pageReviews.length){
      renderReviewCards(pageReviews, append);
    } else if(!append){
      renderNoReviews();
    }

    const paginationEl = document.getElementById('reviewPagination');
    if(useNumericPagination){
      if(loadMoreButton) loadMoreButton.style.display = 'none';
      if(paginationEl) fillPagination(page);
    } else {
      if(loadMoreButton){
        loadMoreButton.style.display = approvedReviews.length > page * reviewsPerPage ? 'inline-flex' : 'none';
      }
      if(paginationEl) paginationEl.innerHTML = '';
    }
  }

  function renderReviewCards(reviews, append){
    const grid = document.querySelector('.reviews-grid');
    const action = grid?.querySelector('.review-action');
    console.log('renderReviewCards:', { grid, action, reviewCount: reviews.length });
    if(!grid || !action) return;

    reviews.forEach(item => {
      const card = createReviewCard(item);
      grid.insertBefore(card, action);
      requestAnimationFrame(() => {
        card.classList.add('visible');
        console.log('Review card added and visible class set:', card);
      });
    });
  }

  function createReviewCard(item){
    const card = document.createElement('div');
    card.className = 'review-card review-entry';
    const reviewDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long' }) : '';
    card.innerHTML = `
      <div class="review-stars">${renderStars(Number(item.rating || 0))}</div>
      <p class="quote">"${escapeHtml(item.review)}"</p>
      <p class="who">— ${escapeHtml(item.name)}</p>
      ${reviewDate ? `<p class="review-date">${reviewDate}</p>` : ''}
    `;
    console.log('Review card created:', item);
    return card;
  }

  function renderNoReviews(){
    const grid = document.querySelector('.reviews-grid');
    const action = grid?.querySelector('.review-action');
    if(!grid || !action) return;
    const empty = document.createElement('div');
    empty.className = 'review-card review-entry';
    empty.innerHTML = `
      <p class="quote">No reviews available yet.</p>
      <p class="who">Be the first customer to leave a review.</p>
    `;
    grid.insertBefore(empty, action);
    requestAnimationFrame(() => empty.classList.add('visible'));
  }

  function fillPagination(activePage){
    const paginationEl = document.getElementById('reviewPagination');
    if(!paginationEl) return;
    const totalPages = Math.ceil(approvedReviews.length / reviewsPerPage);
    let html = '';
    for(let page = 1; page <= totalPages; page++){
      html += `<button class="page-btn${page === activePage ? ' active' : ''}" data-page="${page}">${page}</button>`;
    }
    if(activePage < totalPages){
      html += `<button class="page-btn next-btn" data-page="${activePage + 1}">Next →</button>`;
    }
    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextPage = Number(btn.dataset.page);
        if(nextPage && nextPage !== currentReviewPage){
          currentReviewPage = nextPage;
          renderReviewsPage(currentReviewPage, false);
        }
      });
    });
  }

  if(loadMoreButton){
    loadMoreButton.addEventListener('click', () => {
      currentReviewPage += 1;
      renderReviewsPage(currentReviewPage, true);
    });
  }

  function renderStars(rating){
    return Array.from({ length: 5 }, (_, index) => {
      return `<span class="star ${index < rating ? 'active' : ''}">★</span>`;
    }).join('');
  }

  function escapeHtml(str){
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  loadApprovedReviews();
});

// Project Enquiry Form Handler
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  const formMessage = document.getElementById('contactFormMessage');
  if (!form) return;

  function setFormMessage(text, type = 'error') {
    if (!formMessage) return;
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    setFormMessage('', '');

    const name = document.getElementById('clientName')?.value.trim() || '';
    const phone = document.getElementById('clientPhone')?.value.trim() || '';
    const email = document.getElementById('clientEmail')?.value.trim() || '';
    const projectType = document.getElementById('projectType')?.value || '';
    const budget = document.getElementById('projectBudget')?.value.trim() || '';
    const description = document.getElementById('projectDetails')?.value.trim() || '';

    if (!name || !phone || !projectType || !budget || !description) {
      setFormMessage('Please complete all required fields before submitting your enquiry.', 'error');
      return;
    }

    const message = `🏗️ New Construction Enquiry

👤 Name:
${name}

📞 Phone:
${phone}

📧 Email:
${email}

🏠 Project Type:
${projectType}

💰 Budget:
${budget}

📝 Project Description:
${description}`;

    const whatsappPhone = '919442055719';
    const whatsappURL = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;

    setFormMessage('Opening WhatsApp with your enquiry…', 'success');
    window.open(whatsappURL, '_blank');
    form.reset();
  });
});

