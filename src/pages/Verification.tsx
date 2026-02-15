import React, { useRef, useState, useCallback } from 'react';
import { Link, useHistory } from 'react-router-dom';
import './Verification.css';

const CODE_LENGTH = 4;

const Verification: React.FC = () => {
  const history = useHistory();
  const [code, setCode] = useState<string[]>(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1);
      const next = [...code];
      next[index] = digit;
      setCode(next);
      if (digit && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [code]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [code]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode((prev) => {
      const next = [...prev];
      for (let i = 0; i < pasted.length && i < CODE_LENGTH; i++) {
        next[i] = pasted[i];
      }
      return next;
    });
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== CODE_LENGTH) return;
    // TODO: call verification API
    history.push('/new-password');
  };

  const handleResend = (e: React.MouseEvent) => {
    e.preventDefault();
    setCode(['', '', '', '']);
    inputRefs.current[0]?.focus();
    // TODO: trigger resend API
  };

  const fullCode = code.join('');

  return (
    <div className="verification-page">
      <header className="verification-header">
        <Link to="/register" className="verification-back" aria-label="Go back">
          &lt;
        </Link>
        <h1 className="verification-title">Verification</h1>
      </header>

      <div className="verification-content">
        <p className="verification-instruction">Enter Verification Code</p>

        <form className="verification-form" onSubmit={handleVerify}>
          <div className="verification-inputs" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className="verification-input"
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
                placeholder="0"
              />
            ))}
          </div>

          <p className="verification-resend">
            if you did not receive a code,{' '}
            <button type="button" className="verification-resend-link" onClick={handleResend}>
              resend!
            </button>
          </p>

          <button
            type="submit"
            className="verification-button"
            disabled={fullCode.length !== CODE_LENGTH}
          >
            Verify
          </button>
        </form>
      </div>
    </div>
  );
};

export default Verification;
