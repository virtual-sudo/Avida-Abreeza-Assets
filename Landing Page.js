(function createAbreezaOverlay() {

  if (document.getElementById('abreeza-landing-overlay')) return;



  const bgImageUrl = 'https://raw.githubusercontent.com/virtual-sudo/Avida-Abreeza-Assets/main/Landing%20Page%20Image.png';

  const logoImageUrl = 'https://raw.githubusercontent.com/virtual-sudo/Avida-Abreeza-Assets/main/Frame%204%20(1).png';



  const style = document.createElement('style');

  style.id = 'abreeza-overlay-styles';

  style.textContent = `

    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap');



    #abreeza-landing-overlay {

      position: fixed;

      top: 0;

      left: 0;

      width: 100vw;

      height: 100vh;

      z-index: 2147483647;

      display: flex;

      justify-content: center;

      align-items: center;

      padding: 24px;

      box-sizing: border-box;

      overflow: hidden;

      font-family: 'Montserrat', -apple-system, sans-serif;

      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.8s ease;

    }



    /* Continuous slow background zoom-in animation */

    .abreeza-bg-layer {

      position: absolute;

      inset: 0;

      background-image: 

        linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.55) 100%),

        url('${bgImageUrl}');

      background-size: cover;

      background-position: center;

      animation: abreezaSlowZoomIn 20s linear infinite alternate;

      z-index: 1;

    }



    #abreeza-landing-overlay.fade-out {

      opacity: 0;

      visibility: hidden;

    }



    /* Premium Glassmorphism Card Container */

    .abreeza-card {

      position: relative;

      z-index: 2;

      max-width: 620px;

      width: 100%;

      text-align: center;

      color: #ffffff;

      padding: 50px 40px;

      background: rgba(15, 18, 22, 0.38);

      backdrop-filter: blur(16px);

      -webkit-backdrop-filter: blur(16px);

      border: 1px solid rgba(255, 255, 255, 0.15);

      border-radius: 8px; /* Updated radius */

      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4),

                  inset 0 1px 0 rgba(255, 255, 255, 0.2);

      display: flex;

      flex-direction: column;

      align-items: center;

      

      /* Staggered Fade Up Entrance */

      opacity: 0;

      transform: translateY(25px);

      animation: abreezaFadeUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;

    }



    .abreeza-logo {

      max-width: 420px;

      width: 85%;

      height: auto;

      object-fit: contain;

      margin-bottom: 24px;

      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));

      

      opacity: 0;

      transform: translateY(15px);

      animation: abreezaFadeUp 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;

    }



    .abreeza-divider {

      width: 60px;

      height: 2px;

      background: linear-gradient(90deg, rgba(211, 47, 47, 0) 0%, #e53935 50%, rgba(211, 47, 47, 0) 100%);

      margin: 4px 0 24px 0;

      

      opacity: 0;

      animation: abreezaFadeIn 1s ease 0.7s forwards;

    }



    .abreeza-text {

      font-size: clamp(0.95rem, 1.5vw, 1.05rem);

      line-height: 1.7;

      color: rgba(255, 255, 255, 0.92);

      font-weight: 300;

      letter-spacing: 0.3px;

      margin-bottom: 36px;

      max-width: 480px;

      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);

      

      opacity: 0;

      transform: translateY(15px);

      animation: abreezaFadeUp 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.7s forwards;

    }



    /* Interactive Premium Button */

    .abreeza-btn {

      position: relative;

      background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);

      color: #ffffff;

      font-family: 'Montserrat', sans-serif;

      font-size: 0.85rem;

      font-weight: 600;

      letter-spacing: 3px;

      text-transform: uppercase;

      padding: 16px 48px;

      border: 1px solid rgba(255, 255, 255, 0.3);

      border-radius: 8px; /* Updated radius */

      cursor: pointer;

      overflow: hidden;

      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);

      box-shadow: 0 10px 25px rgba(183, 28, 28, 0.3);

      

      opacity: 0;

      transform: translateY(15px);

      animation: abreezaFadeUp 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards;

    }



    .abreeza-btn:hover {

      background: linear-gradient(135deg, #e53935 0%, #c62828 100%);

      border-color: rgba(255, 255, 255, 0.8);

      letter-spacing: 4px;

      transform: translateY(-2px);

      box-shadow: 0 15px 35px rgba(229, 57, 53, 0.45);

    }



    .abreeza-btn:active {

      transform: translateY(0);

    }



    /* Keyframe Animations */

    @keyframes abreezaSlowZoomIn {

      0% { transform: scale(1.0); }

      100% { transform: scale(1.15); }

    }



    @keyframes abreezaFadeUp {

      0% { opacity: 0; transform: translateY(20px); }

      100% { opacity: 1; transform: translateY(0); }

    }



    @keyframes abreezaFadeIn {

      0% { opacity: 0; }

      100% { opacity: 1; }

    }



    /* Mobile Adjustments */

    @media (max-width: 600px) {

      .abreeza-card {

        padding: 35px 20px;

      }

      .abreeza-btn {

        padding: 14px 32px;

        font-size: 0.8rem;

      }

    }

  `;

  document.head.appendChild(style);



  const overlay = document.createElement('div');

  overlay.id = 'abreeza-landing-overlay';



  overlay.innerHTML = `

    <div class="abreeza-bg-layer"></div>

    <div class="abreeza-card">

      <img 

        src="${logoImageUrl}" 

        alt="Avida Towers Abreeza Logo" 

        class="abreeza-logo"

      />

      <div class="abreeza-divider"></div>

      <p class="abreeza-text">

        At Avida Towers Abreeza, live life as you can imagine it to be. Every day, experience an ease that has you breezing from one day to the next.

      </p>

      <button class="abreeza-btn" id="abreeza-start-btn">EXPLORE TOUR</button>

    </div>

  `;



  document.body.appendChild(overlay);



  document.getElementById('abreeza-start-btn').addEventListener('click', function () {

    overlay.classList.add('fade-out');

    

    setTimeout(() => {

      overlay.remove();

      style.remove();

    }, 800);

  });

})(); 
