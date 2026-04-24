import React, { useState, useEffect } from "react";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { UserProfile, Transaction } from "../types";
import { Wallet as WalletIcon, ArrowDownLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Wallet() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeProfile = onSnapshot(doc(db, "users", auth.currentUser.uid), (snapshot) => {
      const data = snapshot.data() as UserProfile;
      setProfile(data);
    });

    const q = query(
      collection(db, "transactions"),
      where("toId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribeTransactions = onSnapshot(
      q,
      (snapshot) => {
        setTransactions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "transactions")
    );

    return () => {
      unsubscribeProfile();
      unsubscribeTransactions();
    };
  }, []);

  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-sm text-gray-500">Manage your earnings and payments</p>
      </header>

      {/* Balance Card */}
      <div className="relative mb-8 overflow-hidden rounded-[32px] bg-indigo-600 p-8 text-white shadow-2xl shadow-indigo-200">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-100">Total Revenue</span>
            <WalletIcon size={24} className="text-indigo-200" />
          </div>
          <div className="mb-8 text-4xl font-black tracking-tight">
            ${totalRevenue.toLocaleString()}
          </div>
          
          {profile?.role === "freelancer" && (
            <div className="space-y-4">
              <p className="text-center text-[10px] font-medium text-indigo-200">
                Earnings are recorded after you confirm receipt of manual payments from clients.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Recent Transactions</h3>
          <button className="text-xs font-bold text-indigo-600 uppercase tracking-wider">View All</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-4 text-4xl">💸</span>
            <h3 className="mb-1 text-sm font-bold text-gray-900">No earnings yet</h3>
            <p className="max-w-[180px] text-xs text-gray-500">Your earnings will appear here after projects are paid.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <ArrowDownLeft size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900">Payment Received</h4>
                  <p className="text-[10px] font-medium text-gray-400">
                    {format(t.createdAt.toDate(), "MMM dd, yyyy • HH:mm")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-gray-900">+{t.amount}</div>
                  <div className="text-[10px] font-medium text-gray-400">Fee: {t.fee}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
