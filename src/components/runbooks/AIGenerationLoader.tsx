import React from 'react';

interface AIGenerationLoaderProps {
  message?: string;
}

export function AIGenerationLoader({ message = "Generating..." }: AIGenerationLoaderProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="sphere-container">
          <div className="sphere"></div>
          <div className="gooey"></div>
          <div className="svg-centerpiece">
            <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22.27 22.27" width="80" height="80">
              <defs>
                <style>{`.cls-1 { fill: #fff; }`}</style>
              </defs>
              <rect className="cls-1" x="6.69" y="1.19" width="1" height="4.12" rx=".5" ry=".5"/>
              <rect className="cls-1" x="8.64" y="0" width="1" height="10.07" rx=".5" ry=".5"/>
              <rect className="cls-1" x="10.59" y="1.19" width="1" height="7.16" rx=".5" ry=".5"/>
              <rect className="cls-1" x="12.54" y="0" width="1" height="5.79" rx=".5" ry=".5"/>
              <rect className="cls-1" x="14.49" y="1.19" width="1" height="4.12" rx=".5" ry=".5"/>
              <rect className="cls-1" x="6.69" y="16.74" width="1" height="4.33" rx=".5" ry=".5"/>
              <rect className="cls-1" x="8.64" y="14.8" width="1" height="7.47" rx=".5" ry=".5"/>
              <rect className="cls-1" x="10.59" y="13.86" width="1" height="7.16" rx=".5" ry=".5"/>
              <rect className="cls-1" x="12.54" y="15.81" width="1" height="6.47" rx=".5" ry=".5"/>
              <rect className="cls-1" x="14.49" y="16.74" width="1" height="4.35" rx=".5" ry=".5"/>
              <rect className="cls-1" x="18.31" y="12.75" width="1" height="4.53" rx=".5" ry=".5" transform="translate(3.79 33.83) rotate(-90)"/>
              <rect className="cls-1" x="17.75" y="9.05" width="1" height="8.03" rx=".5" ry=".5" transform="translate(5.19 31.32) rotate(-90)"/>
              <rect className="cls-1" x="16.06" y="7.38" width="1" height="7.46" rx=".5" ry=".5" transform="translate(5.45 27.67) rotate(-90)"/>
              <rect className="cls-1" x="17.75" y="5.13" width="1" height="8.05" rx=".5" ry=".5" transform="translate(9.09 27.41) rotate(-90)"/>
              <rect className="cls-1" x="18.32" y="4.93" width="1" height="4.54" rx=".5" ry=".5" transform="translate(11.62 26.02) rotate(-90)"/>
              <rect className="cls-1" x="3.09" y="12.63" width="1" height="4.79" rx=".5" ry=".5" transform="translate(-11.43 18.61) rotate(-90)"/>
              <rect className="cls-1" x="2.49" y="10.08" width="1" height="5.98" rx=".5" ry=".5" transform="translate(-10.08 16.06) rotate(-90)"/>
              <rect className="cls-1" x="3.46" y="9.09" width="1" height="4.04" rx=".5" ry=".5" transform="translate(-7.15 15.07) rotate(-90)"/>
              <rect className="cls-1" x="2.5" y="6.17" width="1" height="5.97" rx=".5" ry=".5" transform="translate(-6.16 12.15) rotate(-90)"/>
              <rect className="cls-1" x="3.09" y="4.81" width="1" height="4.79" rx=".5" ry=".5" transform="translate(-3.62 10.79) rotate(-90)"/>
            </svg>
          </div>
        </div>
        <p className="text-foreground text-lg font-medium animate-pulse">{message}</p>
      </div>
      
      <style>{`
        .sphere-container {
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .sphere {
          width: 160px;
          height: 160px;
          border-radius: 50%;
          border: 1px solid hsl(var(--border));
          box-shadow: hsl(224 76% 60% / 0.24) 0 0 90px 33px, inset 20px 6px 20px 13px hsl(var(--muted) / 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          z-index: 2;
        }

        .gooey {
          background: linear-gradient(120deg, hsl(224 76% 60%) 0%, hsl(224 76% 50%) 100%);
          border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
          width: 150px;
          height: 144px;
          animation: morph 2s linear infinite;
          transform-style: preserve-3d;
          outline: 1px solid transparent;
          will-change: border-radius;
          border: 1px solid hsl(var(--border));
          box-shadow: hsl(224 76% 60% / 0.24) 0 0 90px 33px, inset 20px 6px 20px 13px hsl(var(--muted) / 0.1);
        }

        .gooey:before,
        .gooey:after {
          content: '';
          width: 100%;
          height: 100%;
          display: block;
          position: absolute;
          left: 0;
          top: 0;
          border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
          box-shadow: 5px 5px 89px hsl(224 76% 60% / 0.21);
          will-change: border-radius, transform, opacity;
          animation-delay: 200ms;
          background: linear-gradient(120deg, hsl(224 76% 60% / 0.55) 0%, hsl(224 76% 40% / 0.89) 100%);
        }

        .gooey:before {
          width: 80%;
          animation: morph 1.5s linear infinite;
          opacity: 0.21;
          filter: blur(2px);
          box-shadow: 19px -20px 10px hsl(var(--background));
          mix-blend-mode: multiply;
        }

        .gooey:after {
          width: 100%;
          animation: morph 2s linear infinite;
          animation-delay: 400ms;
          opacity: 0.89;
          filter: blur(2px);
          box-shadow: 10px 10px 10px hsl(224 76% 50% / 0.8);
        }

        .svg-centerpiece {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          z-index: 3;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @keyframes morph {
          0%, 100% {
            border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
            transform: translate3d(0, 0, 0) rotateZ(0.01deg);
          }
          34% {
            border-radius: 70% 30% 46% 54% / 30% 29% 71% 70%;
            transform: translate3d(0, 5px, 0) rotateZ(0.01deg);
          }
          50% {
            opacity: 0.89;
            transform: translate3d(0, 0, 0) rotateZ(0.01deg);
          }
          67% {
            border-radius: 100% 60% 60% 100% / 100% 100% 60% 60%;
            transform: translate3d(0, -3px, 0) rotateZ(0.01deg);
          }
        }
      `}</style>
    </div>
  );
}


