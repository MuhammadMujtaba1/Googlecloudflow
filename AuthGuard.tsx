import React, { useEffect, useState } from "react";
import { auth, signInWithGoogle, signInWithFacebook, db } from "../firebase";
import { 
  onAuthStateChanged, 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification 
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { UserProfile } from "../types";
import { useSearchParams, useLocation } from "react-router-dom";
import { Loader2, AlertTriangle, Mail, Lock, User as UserIcon, Facebook } from "lucide-react";
import { Logo } from "./Logo";
import Onboarding from "./Onboarding";
import LandingPage from "./LandingPage";
import { toast } from "sonner";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleSelection, setRoleSelection] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Auth Tabs
  const [authTab, setAuthTab] = useState<"social" | "email">("social");
  const [emailMode, setEmailMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Handle email verification
        if (firebaseUser.providerData.some(p => p.providerId === "password") && !firebaseUser.emailVerified) {
          setUser(firebaseUser);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          
          // Migrate existing users to have rating fields if missing
          if (profileData.rating === undefined || profileData.ratingCount === undefined || profileData.disputeCount === undefined) {
            const updates: Partial<UserProfile> = {};
            if (profileData.rating === undefined) updates.rating = 4.0;
            if (profileData.ratingCount === undefined) updates.ratingCount = 0;
            if (profileData.disputeCount === undefined) updates.disputeCount = 0;
            if (profileData.banned === undefined) updates.banned = false;
            
            await updateDoc(doc(db, "users", firebaseUser.uid), updates);
            setProfile({ ...profileData, ...updates });
          } else {
            setProfile(profileData);
          }
          
          setRoleSelection(false);
        } else {
          // Check for pre-filled role from invite
          const invitedRole = searchParams.get("role");
          if (invitedRole === "client" || invitedRole === "freelancer") {
            handleRoleSelect(invitedRole as "client" | "freelancer", firebaseUser);
          } else {
            setRoleSelection(true);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [searchParams]);

  const handleRoleSelect = async (role: "freelancer" | "client", currentUser?: User) => {
    const activeUser = currentUser || user;
    if (!activeUser) return;
    
    const newProfile: UserProfile = {
      uid: activeUser.uid,
      displayName: activeUser.displayName || displayName || "Anonymous",
      email: activeUser.email || email || "",
      photoURL: activeUser.photoURL || "",
      role,
      createdAt: Timestamp.now(),
      onboardingCompleted: role === "client", // Clients don't need onboarding
      rating: 4.0,
      ratingCount: 0,
      disputeCount: 0,
      banned: false,
    };

    try {
      await setDoc(doc(db, "users", activeUser.uid), newProfile);
      
      // Track invite acceptance
      const inviteId = searchParams.get("invite");
      if (inviteId) {
        await updateDoc(doc(db, "invites", inviteId), {
          status: "accepted",
          inviteeId: activeUser.uid,
          acceptedAt: Timestamp.now(),
        });
      }

      setProfile(newProfile);
      setRoleSelection(false);
    } catch (err) {
      console.error("Error setting role", err);
    }
  };

  const handleSocialSignIn = async (provider: "google" | "facebook") => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithFacebook();
      }
    } catch (err: any) {
      if (err.code !== "auth/cancelled-popup-request" && err.code !== "auth/popup-closed-by-user") {
        toast.error(err.message || "Authentication failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (emailMode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(result.user);
        toast.success("Verification email sent! Please check your inbox.");
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        if (!result.user.emailVerified) {
          toast.error("Please verify your email before logging in.");
          await sendEmailVerification(result.user);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      toast.success("Verification email resent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend email");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 transition-colors duration-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (user && user.providerData.some(p => p.providerId === "password") && !user.emailVerified) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100">
          <Mail className="h-10 w-10 text-indigo-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">Verify your email</h2>
        <p className="mb-8 text-gray-500 max-w-xs">
          We've sent a verification link to <span className="font-semibold">{user.email}</span>. 
          Please check your inbox and click the link to continue.
        </p>
        <div className="flex flex-col w-full max-w-xs gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
          >
            I've verified my email
          </button>
          <button
            onClick={handleResendVerification}
            className="w-full rounded-2xl bg-white py-4 font-bold text-gray-600 ring-1 ring-gray-200 transition-all hover:bg-gray-50 active:scale-95"
          >
            Resend email
          </button>
          <button
            onClick={() => auth.signOut()}
            className="mt-4 text-sm font-semibold text-gray-400 hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (profile?.banned) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Account Banned</h2>
          <p className="mb-8 text-gray-500">
            Your account has been banned due to unresolved disputes. Please contact support if you believe this is an error.
          </p>
          <button
            onClick={() => auth.signOut()}
            className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    if (location.pathname === "/") {
      return <LandingPage />;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-12 text-center transition-colors duration-200">
        <div className="mb-8 flex items-center justify-center">
          <Logo 
            variant="full" 
            className="max-w-[280px] w-full h-auto text-gray-900" 
          />
        </div>

        <div className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
          {/* Tabs */}
          <div className="mb-8 flex rounded-2xl bg-gray-50 p-1">
            <button
              onClick={() => setAuthTab("social")}
              className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${
                authTab === "social" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
              }`}
            >
              Social
            </button>
            <button
              onClick={() => setAuthTab("email")}
              className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${
                authTab === "email" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
              }`}
            >
              Email
            </button>
          </div>

          {authTab === "social" ? (
            <div className="space-y-4">
              <button
                onClick={() => handleSocialSignIn("google")}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-50"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                Continue with Google
              </button>
              <button
                onClick={() => handleSocialSignIn("facebook")}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1877F2] px-6 py-4 font-semibold text-white shadow-sm transition-all hover:bg-[#166fe5] active:scale-95 disabled:opacity-50"
              >
                <Facebook className="h-5 w-5 fill-current" />
                Continue with Facebook
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              {emailMode === "signup" && (
                <div className="space-y-1">
                  <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full rounded-2xl bg-gray-50 py-4 pl-12 pr-4 text-sm outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl bg-gray-50 py-4 pl-12 pr-4 text-sm outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl bg-gray-50 py-4 pl-12 pr-4 text-sm outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-indigo-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  emailMode === "login" ? "Log In" : "Create Account"
                )}
              </button>
              <p className="text-center text-sm text-gray-500">
                {emailMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setEmailMode(emailMode === "login" ? "signup" : "login")}
                  className="font-bold text-indigo-600 hover:text-indigo-700"
                >
                  {emailMode === "login" ? "Sign Up" : "Log In"}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (roleSelection) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center transition-colors duration-200">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">Choose your role</h2>
        <p className="mb-8 text-gray-500">How will you be using FlowThread?</p>
        <div className="grid w-full max-w-xs gap-4">
          <button
            onClick={() => handleRoleSelect("freelancer")}
            className="group flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-indigo-500"
          >
            <span className="mb-2 text-3xl">👨‍💻</span>
            <span className="font-bold text-gray-900">Freelancer</span>
            <span className="text-sm text-gray-500">I deliver work and get paid</span>
          </button>
          <button
            onClick={() => handleRoleSelect("client")}
            className="group flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition-all hover:ring-indigo-500"
          >
            <span className="mb-2 text-3xl">💼</span>
            <span className="font-bold text-gray-900">Client</span>
            <span className="text-sm text-gray-500">I hire talent and manage projects</span>
          </button>
        </div>
      </div>
    );
  }

  if (profile && profile.role === "freelancer" && !profile.onboardingCompleted) {
    return (
      <Onboarding 
        profile={profile} 
        onComplete={(updatedProfile) => setProfile(updatedProfile)} 
      />
    );
  }

  return <>{children}</>;
}
