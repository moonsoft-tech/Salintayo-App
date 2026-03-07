import React, { useRef, useState, useCallback } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { verifyPasswordResetCode, sendPasswordResetCode } from '../utils/api';
import './Verification.css';

const CODE_LENGTH = 6;

interface LocationState {
  email?: string;
  context?: 'password-reset';
}

const Verification: React.FC = () => {
  const history = useHistory();
  const location = useLocation<LocationState>();
  const { email, context } = location.state || {};
  const isPasswordReset = context === 'password-reset';

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, '').slice(-1);
      setCode((prev) => {
        const next = [...prev];
        next[index] = digit;
        if (digit && index < CODE_LENGTH - 1) {
          setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
        }
        return next;
      });
    },
    []
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== CODE_LENGTH) return;
    if (isPasswordReset && !email) {
      setError('Session expired. Please start over from Forgot Password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isPasswordReset && email) {
        await verifyPasswordResetCode(email, fullCode);
        history.push('/new-password', { email, code: fullCode });
      } else {
        // Registration flow - TODO when implemented
        history.push('/new-password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPasswordReset && email) {
      setResending(true);
      setError('');
      try {
        await sendPasswordResetCode(email);
        setCode(Array(CODE_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resend code.');
      } finally {
        setResending(false);
      }
    } else {
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const fullCode = code.join('');

  if (isPasswordReset && !email) {
    return (
      <div className="verification-page">
        <header className="verification-header">
          <Link to="/forgot-password" className="verification-back" aria-label="Go back">
            &lt;
          </Link>
          <h1 className="verification-title">Verification</h1>
        </header>
        <p className="verification-instruction">Session expired. Please start over.</p>
        <Link to="/forgot-password" className="verification-button" style={{ display: 'inline-block', textAlign: 'center', lineHeight: '56px' }}>
          Back to Forgot Password
        </Link>
      </div>
    );
  }

  return (
    <div className="verification-page">
      <header className="verification-header">
        <Link
          to={isPasswordReset ? '/forgot-password' : '/register'}
          className="verification-back"
          aria-label="Go back"
        >
          &lt;
        </Link>
        <h1 className="verification-title">Verification</h1>
      </header>

      <div className="verification-content">
        <p className="verification-instruction">
          {isPasswordReset ? 'Enter the 6-digit code sent to your email' : 'Enter Verification Code'}
        </p>

        <form className="verification-form" onSubmit={handleVerify}>
          {error && <p className="verification-form__error" role="alert">{error}</p>}
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
            If you did not receive a code,{' '}
            <button
              type="button"
              className="verification-resend-link"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Sending…' : 'resend!'}
            </button>
          </p>

          <button
            type="submit"
            className="verification-button"
            disabled={fullCode.length !== CODE_LENGTH || loading}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Verification;
