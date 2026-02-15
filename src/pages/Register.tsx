import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { hasSeenWelcome } from "../utils/welcomeStorage";
import { isValidEmail } from "../utils/validation";
import "./Register.css";

const imgLogo =
  "https://www.figma.com/api/mcp/asset/9cc5d03f-3d75-459f-9920-f6099cac42a5";
const imgUserIcon =
  "https://www.figma.com/api/mcp/asset/b6af645d-8c6d-4a92-95c9-d181913218c6";
const imgEmailIcon =
  "https://www.figma.com/api/mcp/asset/c7a27c3d-f2c5-4b1c-b4c4-941d2813623e";
const imgLockIcon =
  "https://www.figma.com/api/mcp/asset/06a7244d-6f87-425a-966f-40ae3788f748";

export default function Register() {
  const history = useHistory();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreeTerms) {
      setError("Please agree to the Terms and Conditions.");
      return;
    }

    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(user, { displayName: fullName.trim() });
      history.push(hasSeenWelcome(user.uid) ? "/home" : "/welcome");
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
      const message =
        code === "auth/email-already-in-use"
          ? "This email is already registered."
          : code === "auth/weak-password"
            ? "Password is too weak."
            : "Registration failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-page__inner">
        <header className="register-header">
          <div className="register-header__logo">
            <img src={imgLogo} alt="SalinTayo" />
          </div>
          <h1 className="register-header__title">SalinTayo</h1>
          <p className="register-header__subtitle">
            Create your SalinTayo account
          </p>
          <p className="register-header__tagline">
            Join and start learning Philippine dialects!
          </p>
        </header>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="register-field">
            <div className="register-input-wrap">
              <span className="register-input-wrap__icon" aria-hidden>
                <img src={imgUserIcon} alt="" />
              </span>
              <input
                id="register-fullname"
                type="text"
                placeholder="Full Name"
                aria-label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="register-input"
                autoComplete="name"
              />
            </div>
          </div>

          <div className="register-field">
            <div className="register-input-wrap">
              <span className="register-input-wrap__icon" aria-hidden>
                <img src={imgEmailIcon} alt="" />
              </span>
              <input
                id="register-email"
                type="email"
                placeholder="Email Address"
                aria-label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="register-input"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="register-field">
            <div className="register-input-wrap">
              <span className="register-input-wrap__icon" aria-hidden>
                <img src={imgLockIcon} alt="" />
              </span>
              <input
                id="register-password"
                type="password"
                placeholder="Password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="register-input"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="register-field">
            <div className="register-input-wrap">
              <span className="register-input-wrap__icon" aria-hidden>
                <img src={imgLockIcon} alt="" />
              </span>
              <input
                id="register-confirm-password"
                type="password"
                placeholder="Confirm Password"
                aria-label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="register-input"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="register-terms">
            <input
              id="register-terms"
              type="checkbox"
              className="register-terms__checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              aria-describedby="register-terms-desc"
            />
            <label
              id="register-terms-desc"
              htmlFor="register-terms"
              className="register-terms__label"
            >
              I agree to the{" "}
              <a href="/terms" className="register-terms__link">
                Terms and Conditions
              </a>
            </label>
          </div>

          {error && (
            <p className="register-form__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="register-btn register-btn--primary" disabled={loading}>
            {loading ? "Creating account…" : "Sign Up"}
          </button>

          <p className="register-form__login">
            <span className="register-form__login-text">
              Already have an account?
            </span>{" "}
            <Link to="/login" className="register-form__login-link">
              Login here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
