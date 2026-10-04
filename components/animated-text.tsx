"use client"

import { motion } from "framer-motion"

interface AnimatedTextProps {
  text: string
  delay?: number
}

export function AnimatedText({ text, delay = 0 }: AnimatedTextProps) {
  const words = text.split(" ")
  let charIndex = 0

  return (
    <motion.span
      className="font-bold text-center text-6xl leading-[0.75] tracking-tighter font-serif text-black lg:text-9xl"
      initial="hidden"
      animate="visible"
      style={{ perspective: 400, display: "inline-block" }}
    >
      {words.map((word, wordIndex) => (
        <span key={wordIndex} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          {word.split("").map((char, index) => {
            const currentIndex = charIndex++
            return (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 30, filter: "blur(12px)", rotateX: -45 }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", rotateX: 0 }}
                transition={{
                  duration: 0.6,
                  delay: delay + currentIndex * 0.04,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                style={{
                  display: "inline-block",
                  transformStyle: "preserve-3d",
                  transformOrigin: "center bottom",
                }}
              >
                {char}
              </motion.span>
            )
          })}
          {wordIndex < words.length - 1 && "\u00A0"}
        </span>
      ))}
    </motion.span>
  )
}
