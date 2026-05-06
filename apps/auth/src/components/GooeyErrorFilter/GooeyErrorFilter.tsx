'use client';

import { animate, useMotionValue } from 'motion/react';
import { useEffect, useRef } from 'react';

export default function GooeyErrorFilter({ isError }: { isError: boolean }) {
    const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
    const displacementScale = useMotionValue(0);

    useEffect(() => {
        const unsubscribe = displacementScale.on('change', (latest) => {
            if (displacementRef.current) {
                displacementRef.current.scale.baseVal = latest;
            }
        });
        return () => unsubscribe();
    }, [displacementScale]);

    useEffect(() => {
        if (isError) {
            animate(displacementScale, [0, 8, -10, 6, -3, 0], {
                duration: 0.6,
                ease: 'easeInOut',
            });
        }
    }, [isError, displacementScale]);

    return (
        <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
            <defs>
                <filter id="error-jello" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise" />
                    <feDisplacementMap
                        ref={displacementRef}
                        in="SourceGraphic"
                        in2="noise"
                        scale="0"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </defs>
        </svg>
    );
}
