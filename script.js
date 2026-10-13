const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

const cards = [...document.querySelectorAll("[data-card]")];
const dots = [...document.querySelectorAll("[data-dot]")];
const count = document.querySelector(".carousel-count");
let activeCard = 0;
let carouselTimer;

function showCard(index) {
  if (!cards.length) return;
  activeCard = (index + cards.length) % cards.length;
  cards.forEach((card, cardIndex) => card.classList.toggle("active", cardIndex === activeCard));
  dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === activeCard));
  if (count) count.textContent = `0${activeCard + 1} / 03`;
}

function restartCarousel() {
  window.clearInterval(carouselTimer);
  carouselTimer = window.setInterval(() => showCard(activeCard + 1), 4500);
}

document.querySelector("[data-previous]")?.addEventListener("click", () => {
  showCard(activeCard - 1);
  restartCarousel();
});

document.querySelector("[data-next]")?.addEventListener("click", () => {
  showCard(activeCard + 1);
  restartCarousel();
});

dots.forEach((dot, index) => {
  dot.addEventListener("click", () => {
    showCard(index);
    restartCarousel();
  });
});

if (cards.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  restartCarousel();
}
