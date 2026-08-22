import React, { useCallback, useMemo, useState } from 'react';
import { Loader2, Check, X, Eye, EyeOff } from 'lucide-react';
import logo from '../../../assets/classmind-logo.png';
import styles from './create_account.module.css';
import { authApi } from '../../../lib/api';

const GoogleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      fill="#EA4335"
    />
  </svg>
);

export default function CreateAccount({ onCreateAccount, onGoogleSignIn, onSwitchToSignIn }) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [classroomCode, setClassroomCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const busy = isSubmitting || isGoogleLoading;

  // Email format validation helper
  const isEmailValid = useMemo(() => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  // Password strength checklist rules
  const passwordChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const passedCount = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length;
  }, [passwordChecks]);

  // Calculate strength level
  const strengthInfo = useMemo(() => {
    if (password.length === 0) return { label: '', level: 0, class: '' };
    if (passedCount <= 2) return { label: 'Weak', level: 1, class: styles.strengthWeak };
    if (passedCount <= 4) return { label: 'Fair', level: 2, class: styles.strengthFair };
    return { label: 'Strong', level: 3, class: styles.strengthStrong };
  }, [password, passedCount]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (busy) return;
      setFormError('');

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFormError('Please enter a valid email address (e.g. name@example.com).');
        return;
      }

      // Validate password strength criteria
      if (passedCount < 5) {
        setFormError('Password must meet all 5 security requirements below.');
        return;
      }

      setIsSubmitting(true);
      try {
        if (onCreateAccount) {
          await onCreateAccount({ fullName, role, email, password, classroomCode: classroomCode.trim() });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      } catch (err) {
        setFormError(err?.message || 'Could not create your account. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [busy, fullName, role, email, password, classroomCode, passedCount, onCreateAccount]
  );

  const handleGoogleSignIn = useCallback(() => {
    if (busy) return;
    setIsGoogleLoading(true);
    setFormError('');
    if (onGoogleSignIn) {
      onGoogleSignIn({ role });
    } else {
      // Full-page browser navigation to Google consent screen (attaching selected role)
      const targetRole = (role || 'student').toUpperCase();
      window.location.href = authApi.getGoogleAuthUrl({ role: targetRole });
    }
  }, [busy, role, onGoogleSignIn]);

  return (
    <div className={styles.page}>
      <div className={styles.brandRow}>
        <img src={logo} alt="Temar Lije logo" className={styles.brandLogo} />
        <span className={styles.brandName}>Temar Lije</span>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs} role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className={styles.tabInactive}
            onClick={onSwitchToSignIn}
          >
            Sign in
          </button>
          <button type="button" role="tab" aria-selected="true" className={styles.tabActive}>
            Create account
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.fieldLabel} htmlFor="ca-full-name">
            Full name
          </label>
          <input
            id="ca-full-name"
            type="text"
            required
            placeholder="Amina Yusuf"
            className={styles.textInput}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={busy}
            autoComplete="name"
          />

          <span className={styles.fieldLabel}>I am a</span>
          <div className={styles.roleToggle} role="radiogroup" aria-label="I am a">
            <button
              type="button"
              role="radio"
              aria-checked={role === 'student'}
              className={`${styles.roleOption} ${role === 'student' ? styles.roleOptionActive : ''}`}
              onClick={() => setRole('student')}
              disabled={busy}
            >
              Student
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={role === 'teacher'}
              className={`${styles.roleOption} ${role === 'teacher' ? styles.roleOptionActive : ''}`}
              onClick={() => setRole('teacher')}
              disabled={busy}
            >
              Teacher
            </button>
          </div>

          {role === 'student' && (
            <>
              <label className={styles.fieldLabel} htmlFor="ca-classroom">
                Classroom Code <span style={{ fontWeight: 400, color: '#64748b', fontSize: '12px' }}>(Optional - choose classroom)</span>
              </label>
              <input
                id="ca-classroom"
                type="text"
                placeholder="e.g. REACT-101 (or join from dashboard later)"
                className={styles.textInput}
                value={classroomCode}
                onChange={(e) => setClassroomCode(e.target.value)}
                disabled={busy}
              />
            </>
          )}

          <label className={styles.fieldLabel} htmlFor="ca-email">
            Email
          </label>
          <input
            id="ca-email"
            type="email"
            required
            placeholder="amina@example.com"
            className={styles.textInput}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formError) setFormError('');
            }}
            onBlur={() => setEmailTouched(true)}
            disabled={busy}
            autoComplete="email"
          />
          {emailTouched && !isEmailValid && (
            <span className={styles.fieldError}>Please enter a valid email format.</span>
          )}

          <label className={styles.fieldLabel} htmlFor="ca-password">
            Password
          </label>
          <div className={styles.inputWrapper}>
            <input
              id="ca-password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              className={styles.textInput}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formError) setFormError('');
              }}
              disabled={busy}
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className={styles.togglePasswordBtn}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Real-time Password Strength Meter & Checklist */}
          {password.length > 0 && (
            <div className={styles.passwordStrength}>
              <div className={styles.strengthHeader}>
                <span>Password Strength</span>
                <span className={`${styles.strengthBadge} ${strengthInfo.class}`}>
                  {strengthInfo.label}
                </span>
              </div>

              <div className={styles.strengthMeter}>
                <span
                  className={`${styles.strengthSegment} ${
                    passedCount >= 1 ? (passedCount === 5 ? styles.segStrong : passedCount >= 3 ? styles.segFair : styles.segWeak) : ''
                  }`}
                />
                <span
                  className={`${styles.strengthSegment} ${
                    passedCount >= 3 ? (passedCount === 5 ? styles.segStrong : styles.segFair) : ''
                  }`}
                />
                <span
                  className={`${styles.strengthSegment} ${
                    passedCount >= 5 ? styles.segStrong : ''
                  }`}
                />
              </div>

              <ul className={styles.reqList}>
                <li className={`${styles.reqItem} ${passwordChecks.length ? styles.reqMet : styles.reqUnmet}`}>
                  {passwordChecks.length ? <Check className={styles.reqIcon} /> : <X className={styles.reqIcon} />}
                  <span>8+ characters</span>
                </li>
                <li className={`${styles.reqItem} ${passwordChecks.upper ? styles.reqMet : styles.reqUnmet}`}>
                  {passwordChecks.upper ? <Check className={styles.reqIcon} /> : <X className={styles.reqIcon} />}
                  <span>Uppercase (A-Z)</span>
                </li>
                <li className={`${styles.reqItem} ${passwordChecks.lower ? styles.reqMet : styles.reqUnmet}`}>
                  {passwordChecks.lower ? <Check className={styles.reqIcon} /> : <X className={styles.reqIcon} />}
                  <span>Lowercase (a-z)</span>
                </li>
                <li className={`${styles.reqItem} ${passwordChecks.number ? styles.reqMet : styles.reqUnmet}`}>
                  {passwordChecks.number ? <Check className={styles.reqIcon} /> : <X className={styles.reqIcon} />}
                  <span>Number (0-9)</span>
                </li>
                <li className={`${styles.reqItem} ${passwordChecks.special ? styles.reqMet : styles.reqUnmet}`}>
                  {passwordChecks.special ? <Check className={styles.reqIcon} /> : <X className={styles.reqIcon} />}
                  <span>Symbol (!@#$%^&*)</span>
                </li>
              </ul>
            </div>
          )}

          {formError && (
            <p className={styles.inlineError} role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={busy}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className={`${styles.spinner} animate-spin`} />
                <span>Creating account…</span>
              </>
            ) : (
              <span>Create account</span>
            )}
          </button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine} />
        </div>

        <button
          type="button"
          className={styles.googleButton}
          onClick={handleGoogleSignIn}
          disabled={busy}
          aria-busy={isGoogleLoading}
        >
          {isGoogleLoading ? (
            <Loader2 className={`${styles.spinner} animate-spin`} />
          ) : (
            <GoogleIcon className={styles.googleIcon} />
          )}
          <span>{isGoogleLoading ? 'Connecting…' : 'Continue with Google'}</span>
        </button>
      </div>
    </div>
  );
}