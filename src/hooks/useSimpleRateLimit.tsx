import { useState, useCallback, useRef } from "react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

// Simple in-memory rate limiting that doesn't interfere with auth state
export const useSimpleRateLimit = () => {
  const attemptsRef = useRef<Map<string, AttemptRecord>>(new Map());
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const checkRateLimit = useCallback((identifier: string): boolean => {
    const now = Date.now();
    const record = attemptsRef.current.get(identifier);

    if (!record) {
      return true; // No record, allow
    }

    // Check if locked
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
      setIsLocked(true);
      setLockMessage(`Too many attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`);
      return false;
    }

    // If lock expired, reset
    if (record.lockedUntil && now >= record.lockedUntil) {
      attemptsRef.current.delete(identifier);
      setIsLocked(false);
      setLockMessage(null);
      return true;
    }

    // Reset if first attempt was more than 15 minutes ago
    if (now - record.firstAttempt > LOCKOUT_DURATION_MS) {
      attemptsRef.current.delete(identifier);
      return true;
    }

    return true;
  }, []);

  const recordFailedAttempt = useCallback((identifier: string): { allowed: boolean; remaining: number } => {
    const now = Date.now();
    const record = attemptsRef.current.get(identifier);

    if (!record) {
      attemptsRef.current.set(identifier, {
        count: 1,
        firstAttempt: now,
        lockedUntil: null,
      });
      return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
    }

    // Check if already locked
    if (record.lockedUntil && now < record.lockedUntil) {
      return { allowed: false, remaining: 0 };
    }

    const newCount = record.count + 1;

    if (newCount >= MAX_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_DURATION_MS;
      attemptsRef.current.set(identifier, {
        ...record,
        count: newCount,
        lockedUntil,
      });
      setIsLocked(true);
      setLockMessage(`Too many failed attempts. Please try again in 15 minutes.`);
      return { allowed: false, remaining: 0 };
    }

    attemptsRef.current.set(identifier, {
      ...record,
      count: newCount,
    });

    return { allowed: true, remaining: MAX_ATTEMPTS - newCount };
  }, []);

  const recordSuccess = useCallback((identifier: string) => {
    attemptsRef.current.delete(identifier);
    setIsLocked(false);
    setLockMessage(null);
  }, []);

  const resetState = useCallback(() => {
    setIsLocked(false);
    setLockMessage(null);
  }, []);

  return {
    isLocked,
    lockMessage,
    checkRateLimit,
    recordFailedAttempt,
    recordSuccess,
    resetState,
  };
};
