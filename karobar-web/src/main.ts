import "./styles.css";

type GridPoint = {
  x: number;
  y: number;
};

const canvas = document.querySelector<HTMLCanvasElement>(".background-canvas");

if (canvas) {
  const context = canvas.getContext("2d");

  if (context) {
    const points: GridPoint[] = [];
    const pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      active: false,
      radius: 140,
    };

    function resizeCanvas(): void {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function buildGrid(): void {
      points.length = 0;
      const spacing = window.innerWidth < 700 ? 30 : 38;

      for (let x = spacing / 2; x < window.innerWidth; x += spacing) {
        for (let y = spacing / 2; y < window.innerHeight; y += spacing) {
          points.push({ x, y });
        }
      }
    }

    function drawGrid(): void {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const spacing = window.innerWidth < 700 ? 30 : 38;
      context.strokeStyle = "rgba(255, 255, 255, 0.045)";
      context.lineWidth = 1;

      for (let x = spacing / 2; x < window.innerWidth; x += spacing) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, window.innerHeight);
        context.stroke();
      }

      for (let y = spacing / 2; y < window.innerHeight; y += spacing) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(window.innerWidth, y);
        context.stroke();
      }

      for (const point of points) {
        const dx = point.x - pointer.x;
        const dy = point.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        const glow = pointer.active ? Math.max(0, 1 - distance / pointer.radius) : 0;
        const size = 0.8 + glow * 1.6;
        const alpha = 0.14 + glow * 0.7;
        const color = glow > 0
          ? `rgba(30, 215, 96, ${alpha})`
          : "rgba(255, 255, 255, 0.14)";

        context.fillStyle = color;
        context.beginPath();
        context.arc(point.x, point.y, size, 0, Math.PI * 2);
        context.fill();
      }
    }

    function renderGrid(): void {
      drawGrid();
      window.requestAnimationFrame(renderGrid);
    }

    window.addEventListener("resize", () => {
      resizeCanvas();
      buildGrid();
    });

    window.addEventListener("pointermove", (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    });

    window.addEventListener("pointerdown", (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    });

    window.addEventListener("pointerleave", () => {
      pointer.active = false;
    });

    resizeCanvas();
    buildGrid();
    renderGrid();
  }
}

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
  .querySelectorAll<HTMLElement>(".hero-copy, .feature-card, .timeline-item, .setup-card, .footer-inner")
  .forEach((node, index) => {
    node.classList.add("reveal");
    node.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
    observer.observe(node);
  });
