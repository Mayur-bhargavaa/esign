import { useEffect, useRef } from 'react';
import SignaturePad from 'signature_pad';

type SignatureCanvasProps = {
  onReady: (pad: SignaturePad) => void;
};

export default function SignatureCanvas({ onReady }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;

    const context = canvas.getContext('2d');
    if (context) {
      context.scale(ratio, ratio);
    }

    const signaturePad = new SignaturePad(canvas, {
      minWidth: 1,
      maxWidth: 2.5,
      penColor: '#111827'
    });

    onReady(signaturePad);

    return () => {
      signaturePad.off();
    };
  }, [onReady]);

  return (
    <canvas
      ref={canvasRef}
      className="canvas-signature"
      aria-label="Signature canvas"
    />
  );
}
