(() => {
  const carousel = document.querySelector("[data-carousel]");

  if (!carousel) return;

  const track = carousel.querySelector("#feature-gallery");
  const slides = [...carousel.querySelectorAll("[data-carousel-slide]")];
  const dots = [...carousel.querySelectorAll("[data-carousel-dot]")];
  const previous = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = 0;
  let ticking = false;
  let lastScrollLeft = track.scrollLeft;

  const getActiveIndex = () => {
    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;

    return slides.reduce((closestIndex, slide, index) => {
      const slideRect = slide.getBoundingClientRect();
      const slideCenter = slideRect.left + slideRect.width / 2;
      const closestRect = slides[closestIndex].getBoundingClientRect();
      const closestCenter = closestRect.left + closestRect.width / 2;

      return Math.abs(slideCenter - trackCenter) < Math.abs(closestCenter - trackCenter)
        ? index
        : closestIndex;
    }, 0);
  };

  const update = (index = getActiveIndex()) => {
    activeIndex = index;
    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle("is-active", isActive);

      if (isActive) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    if (previous) previous.disabled = activeIndex === 0;
    if (next) next.disabled = activeIndex === slides.length - 1;
  };

  const scrollToSlide = (index) => {
    const slide = slides[index];

    if (!slide) return;

    const trackRect = track.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const left = track.scrollLeft
      + slideRect.left
      - trackRect.left
      - (trackRect.width - slideRect.width) / 2;

    track.scrollTo({
      left,
      behavior: reduceMotion ? "auto" : "smooth"
    });
    update(index);
  };

  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;

    const runUpdate = () => {
      lastScrollLeft = track.scrollLeft;
      update();
      ticking = false;
    };

    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(runUpdate);
    } else {
      window.setTimeout(runUpdate, 16);
    }
  }, { passive: true });

  window.setInterval(() => {
    const currentScrollLeft = track.scrollLeft;

    if (Math.abs(currentScrollLeft - lastScrollLeft) > 1) {
      lastScrollLeft = currentScrollLeft;
      update();
    }
  }, 180);

  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToSlide(Math.min(activeIndex + 1, slides.length - 1));
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToSlide(Math.max(activeIndex - 1, 0));
    }
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => scrollToSlide(index));
  });

  if (previous) {
    previous.addEventListener("click", () => scrollToSlide(Math.max(activeIndex - 1, 0)));
  }

  if (next) {
    next.addEventListener("click", () => scrollToSlide(Math.min(activeIndex + 1, slides.length - 1)));
  }

  window.addEventListener("resize", () => update(), { passive: true });
  update(0);
})();
