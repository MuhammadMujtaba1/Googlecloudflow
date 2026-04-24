import { Timestamp } from "firebase/firestore";

export type UserRole = "freelancer" | "client" | "admin";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  demoMode?: boolean;
  createdAt: Timestamp;
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  // New fields
  skills?: string[];
  location?: string;
  bio?: string;
  portfolioUrl?: string;
  onboardingCompleted?: boolean;
  rating?: number;
  ratingCount?: number;
  banned?: boolean;
  disputeCount?: number;
}

export interface Thread {
  id: string;
  title: string;
  participants: string[];
  clientId?: string;
  freelancerId?: string;
  workPostId?: string;
  lastMessage?: string;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  createdAt: Timestamp;
  threadId: string; // Added for easier notification filtering
  type?: "text" | "file" | "voice";
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  voiceUrl?: string; // Keeping for backward compatibility if needed, but requirements say fileUrl
  duration?: number;
  seenBy?: string[];
  edited?: boolean;
}

export type TaskStatus = 
  | "pending" 
  | "waiting_payment_details" 
  | "waiting_client_confirmation" 
  | "waiting_freelancer_confirmation" 
  | "in_progress" 
  | "delivered" 
  | "completed"
  | "disputed"
  | "cancelled";

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: Timestamp;
  price: number;
  status: TaskStatus;
  deliveryUrl?: string;
  deliveryType?: string;
  deliveryFileName?: string;
  paymentMethod?: string;
  freelancerPaymentDetails?: string;
  paymentProofUrl?: string;
  threadId: string;
  creatorId: string;
  clientId: string;
  freelancerId: string;
  createdAt: Timestamp;
  clientVote?: string;
  freelancerVote?: string;
}

export interface Rating {
  id: string;
  raterId: string;
  ratedUserId: string;
  taskId: string;
  stars: number;
  createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  taskId: string;
  amount: number;
  fee: number;
  status: string;
  fromId: string;
  toId: string;
  createdAt: Timestamp;
}

export interface WorkPost {
  id: string;
  title: string;
  description: string;
  budget: number;
  category: string;
  deadline: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  status: "open" | "closed";
  createdAt: Timestamp;
}

export interface TimelineItem {
  id: string;
  type: "message" | "milestone_created" | "milestone_sent" | "payment" | "work_posted";
  title: string;
  subtitle: string;
  projectName: string;
  userAvatar: string;
  createdAt: Timestamp;
  data?: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "message" | "task_status" | "task_created" | "payment" | "delivery";
  link: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface TimelineEvent {
  id: string;
  type: 'message' | 'task_created' | 'task_status_changed' | 'payment' | 'freelancer_update' | 'milestone_achieved';
  title: string;
  description: string;
  timestamp: Timestamp;
  userId: string;
  metadata?: any;
}
