import "./styles.css";

const observer = new IntersectionObserver(
  (entries, currentObserver) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    }
  },
  {
    threshold: 0.18,
  }
);

document
  .querySelectorAll<HTMLElement>(".hero-copy, .hero-card, .feature-card, .timeline-item, .setup-card")
  .forEach((node, index) => {
    node.classList.add("reveal");
    node.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
    observer.observe(node);
  });
