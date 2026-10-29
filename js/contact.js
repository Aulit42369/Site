  // Envoi sans quitter la page : Formspree répond en JSON si on le lui
  // demande, on affiche alors le message de confirmation à la place du
  // formulaire plutôt que de rediriger vers une page à part.
  const form = document.getElementById('contactForm');
  const successBox = document.getElementById('successBox');
  const formError = document.getElementById('formError');
  const openedAt = Date.now();
  const MIN_FILL_MS = 3000; // un humain met plus de 3 s à remplir le formulaire, un robot non

  // Messages d'erreur en français, quel que soit le navigateur
  const MESSAGES = {
    name: { valueMissing: 'Indique ton nom ou ton pseudo.', tooShort: 'Ton nom doit faire au moins 2 caractères.' },
    email: { valueMissing: 'Indique ton adresse e-mail pour que je puisse te répondre.', typeMismatch: 'Cette adresse e-mail ne semble pas valide (ex. : nom@exemple.fr).' },
    message: { valueMissing: 'Écris ton message.', tooShort: 'Ton message est un peu court (10 caractères minimum).' },
  };
  form.querySelectorAll('input:not([name="_gotcha"]), textarea').forEach((el) => {
    el.addEventListener('invalid', () => {
      const m = MESSAGES[el.name] || {};
      const k = Object.keys(m).find((key) => el.validity[key]);
      el.setCustomValidity(k ? m[k] : '');
    });
    el.addEventListener('input', () => el.setCustomValidity(''));
  });

  function showSuccess() {
    form.style.display = 'none';
    successBox.classList.add('show');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;
    // Anti-spam : champ piège rempli ou envoi trop rapide = robot. On fait
    // comme si tout allait bien, sans rien envoyer.
    if (form.elements._gotcha.value || Date.now() - openedAt < MIN_FILL_MS) {
      showSuccess();
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi...';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        showSuccess();
      } else {
        throw new Error('Échec de l\'envoi');
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer';
      formError.textContent = "L'envoi a échoué — réessaie, ou passe par le Discord en attendant.";
      formError.hidden = false;
    }
  });
