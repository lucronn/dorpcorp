import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export const CustomCursor: React.FC = () => {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Smooth out the motion using a spring
  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const smoothX = useSpring(cursorX, springConfig);
  const smoothY = useSpring(cursorY, springConfig);

  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      const { clientX, clientY } = e;

      let targetX = clientX;
      let targetY = clientY;
      let hovering = false;

      // Find all magnetic elements
      const magneticElements = document.querySelectorAll("[data-magnetic]");

      // How close the mouse needs to be to trigger the magnetic effect
      const MAGNETIC_PULL_RADIUS = 60;
      // 0 = no pull, 1 = snapped exactly to center
      const PULL_STRENGTH = 0.5; 

      magneticElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distanceX = clientX - centerX;
        const distanceY = clientY - centerY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        if (distance < MAGNETIC_PULL_RADIUS) {
          hovering = true;
          // Apply magnetic pull towards the center
          targetX = clientX - distanceX * PULL_STRENGTH;
          targetY = clientY - distanceY * PULL_STRENGTH;
        }
      });

      setIsHovering(hovering);
      cursorX.set(targetX);
      cursorY.set(targetY);
    };

    window.addEventListener("mousemove", moveCursor);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
    };
  }, [cursorX, cursorY]);

  useEffect(() => {
    // Hide the native cursor
    const style = document.createElement("style");
    style.innerHTML = `
      * {
        cursor: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <motion.div
      className="fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none z-[9999] flex items-center justify-center mix-blend-difference"
      style={{
        x: smoothX,
        y: smoothY,
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      <motion.div
        className="absolute w-full h-full rounded-full border border-white/80"
        animate={{
          scale: isHovering ? 1.5 : 1,
          opacity: isHovering ? 0 : 1,
        }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="absolute w-1.5 h-1.5 bg-white rounded-full"
        animate={{
          scale: isHovering ? 0 : 1,
        }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="absolute bg-white rounded-full"
        animate={{
          width: isHovering ? 48 : 0,
          height: isHovering ? 48 : 0,
          opacity: isHovering ? 0.25 : 0,
        }}
        transition={{ duration: 0.2 }}
      />
    </motion.div>
  );
};
