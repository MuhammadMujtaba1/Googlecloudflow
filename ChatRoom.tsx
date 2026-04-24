import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  getDocs,
} from "firebase/firestore";
import { Message, Task, UserProfile, Notification, TimelineEvent } from "../types";
import { Send, Plus, X, Calendar, DollarSign, CheckCircle2, ExternalLink, Loader2, Sparkles, Trash2, FileText, MapPin, Globe, Briefcase, MoreVertical, Edit2, Check, CheckCheck, History, MessageSquare, CreditCard, Star, AlertTriangle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, addDays, parseISO, isValid } from "date-fns";
import { clsx } from "clsx";
import { GoogleGenAI, Type } from "@google/genai";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  "Google Pay",
  "Apple Pay",
  "Stripe",
  "PayPal",
  "Cash App",
  "Venmo",
  "JazzCash",
  "Easypaisa",
  "NayaPay",
  "SadaPay",
  "Credit Card",
  "Other"
];

export default function ChatRoom() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState<string | null>(null);
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analyzingMessageId, setAnalyzingMessageId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "waiting_payment_details" | "waiting_client_confirmation" | "waiting_freelancer_confirmation" | "in_progress" | "delivered" | "completed" | "disputed">("all");
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [showDeleteTaskModal, setShowDeleteTaskModal] = useState<string | null>(null);
  const [showDeleteAllTasksModal, setShowDeleteAllTasksModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<UserProfile | null>(null);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showEditMsgModal, setShowEditMsgModal] = useState(false);
  const [freelancerPaymentDetails, setFreelancerPaymentDetails] = useState("");
  const prevTasksRef = useRef<Task[]>([]);
  const analyzedMessagesRef = useRef<Set<string>>(new Set());
  const [suggestion, setSuggestion] = useState<{
    messageId: string;
    title: string;
    description: string;
    price: number;
    deadline: string;
  } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showRatingModal, setShowRatingModal] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [hasRatedTasks, setHasRatedTasks] = useState<Record<string, boolean>>({});
  const [showMsgMenuId, setShowMsgMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "timeline">("chat");
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [updateText, setUpdateText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isParticipant = thread?.participants?.includes(auth.currentUser?.uid);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    deadline: format(new Date(), "yyyy-MM-dd"),
    price: 0,
  });

  // Mark messages as seen
  useEffect(() => {
    if (!auth.currentUser || !threadId || messages.length === 0 || !thread) return;

    const uid = auth.currentUser.uid;
    
    // Only mark as seen if the user is a participant
    if (!thread.participants?.includes(uid)) return;

    const unseenMessages = messages.filter(m => 
      m.senderId !== uid && (!m.seenBy || !m.seenBy.includes(uid))
    );

    if (unseenMessages.length > 0) {
      console.log(`[Read Receipts] Marking ${unseenMessages.length} messages as seen by ${uid}`);
      unseenMessages.forEach(async (m) => {
        try {
          const msgRef = doc(db, "threads", threadId, "messages", m.id);
          await updateDoc(msgRef, {
            seenBy: [...(m.seenBy || []), uid]
          });
        } catch (err) {
          console.error("Error updating read receipt", err);
        }
      });
    }
  }, [messages, threadId, thread]);

  useEffect(() => {
    if (!auth.currentUser || !threadId) return;
    const fetchProfile = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) setUserProfile(userDoc.data() as UserProfile);
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };
    fetchProfile();

    const fetchThread = async () => {
      try {
        if (!threadId) return;
        const threadDoc = await getDoc(doc(db, "threads", threadId));
        if (threadDoc.exists()) {
          const data = threadDoc.data();
          setThread({ id: threadDoc.id, ...data });
          if (!data.clientId || !data.freelancerId) {
            setError("This thread is invalid. Please create a new thread from a work post.");
          }
        } else {
          setError("Thread not found.");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `threads/${threadId}`);
        setError("Failed to load thread details.");
      }
    };
    fetchThread();
  }, [threadId]);

  useEffect(() => {
    if (!threadId || error) return;

    const messagesQuery = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `threads/${threadId}/messages`)
    );

    const tasksQuery = query(
      collection(db, "threads", threadId, "tasks"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        console.log(`[Tasks Listener] Received ${snapshot.docs.length} tasks for thread ${threadId}`);
        setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
      },
      (err) => {
        console.error(`[Tasks Listener] Error:`, err);
        handleFirestoreError(err, OperationType.LIST, `threads/${threadId}/tasks`);
      }
    );

    const timelineQuery = query(
      collection(db, "threads", threadId, "timeline"),
      orderBy("timestamp", "desc")
    );

    const unsubscribeTimeline = onSnapshot(
      timelineQuery,
      (snapshot) => {
        setTimelineEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TimelineEvent)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `threads/${threadId}/timeline`)
    );

    return () => {
      unsubscribeMessages();
      unsubscribeTasks();
      unsubscribeTimeline();
    };
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage.senderId === auth.currentUser?.uid && lastMessage.senderId !== "system") {
        if (!analyzedMessagesRef.current.has(lastMessage.id)) {
          analyzedMessagesRef.current.add(lastMessage.id);
          const isDirectCommand = lastMessage.text.toLowerCase().startsWith("@flow ai") || lastMessage.text.toLowerCase().startsWith("hi flow ai");
          
          if (isDirectCommand) {
             setSuggestion(null);
             analyzeMessage(lastMessage, true);
          } else if (userProfile?.role === "client") {
             setSuggestion(null);
             analyzeMessage(lastMessage, false);
          }
        }
      }
    }
  }, [messages, tasks, userProfile]);

  useEffect(() => {
    if (prevTasksRef.current.length > 0) {
      tasks.forEach(task => {
        const prevTask = prevTasksRef.current.find(t => t.id === task.id);
        if (prevTask && prevTask.status !== task.status) {
          toast.success(`Task status updated to ${task.status.replace(/_/g, " ")}`);
        }
      });
    }
    prevTasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!auth.currentUser?.uid || tasks.length === 0) return;
    
    const completedTaskIds = tasks.filter(t => t.status === "completed").map(t => t.id);
    if (completedTaskIds.length === 0) return;

    const q = query(collection(db, "ratings"), where("raterId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rated: Record<string, boolean> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        rated[data.taskId] = true;
      });
      setHasRatedTasks(rated);
    }, (error) => {
      console.error("Error fetching ratings:", error);
    });
    return () => unsubscribe();
  }, [tasks, auth.currentUser?.uid]);

  const addTimelineEvent = async (event: Omit<TimelineEvent, 'id'>) => {
    if (!threadId) return;
    try {
      await addDoc(collection(db, "threads", threadId, "timeline"), {
        ...event,
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid,
      });
    } catch (err) {
      console.error("Error adding timeline event", err);
    }
  };

  const handlePostUpdate = async () => {
    if (!updateText.trim() || !threadId) return;
    
    setIsSubmitting(true);
    try {
      await addTimelineEvent({
        type: 'freelancer_update',
        title: 'Freelancer posted an update',
        description: updateText,
        metadata: { senderName: auth.currentUser?.displayName },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });
      setUpdateText("");
      toast.success("Update posted to timeline");
    } catch (err) {
      toast.error("Failed to post update");
    } finally {
      setIsSubmitting(false);
    }
  };

  const analyzeMessage = async (message: Message, isDirectCommand: boolean = false) => {
    // Skip if there's already a pending task, UNLESS it's a direct command
    if (!isDirectCommand && tasks.some(t => t.status === "pending")) return;

    const text = message.text.toLowerCase();
    
    if (!isDirectCommand) {
      const keywords = ["can you", "could you", "i need", "build", "design", "write", "create", "fix", "help me with", "how much", "price", "deadline", "by"];
      const matches = keywords.filter(k => text.includes(k));
      if (matches.length < 2) return;
    }

    setAnalyzingMessageId(message.id);

    try {
      let extractedData: any = null;

      // Try Gemini API
      if (process.env.GEMINI_API_KEY) {
        try {
          const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          const prompt = isDirectCommand 
            ? `You are Flow AI, a smart assistant helping a client and freelancer manage their project.
Analyze the conversation and the latest message.
If the user is asking to create a task/milestone, extract the title, price (number), and deadline (YYYY-MM-DD).
If you have enough information (title, price, and deadline), set intent to "create_task".
If you are missing price or deadline, set intent to "ask_question" and provide a helpful reply asking for the missing details.
Respond ONLY with a JSON object in this format:
{
  "intent": "create_task" | "ask_question" | "none",
  "task": { "title": "...", "price": 100, "deadline": "YYYY-MM-DD" },
  "reply": "Your response if asking a question"
}

Latest Message: "${message.text}"`
            : `Extract from the following message: task title, deadline (as ISO date if possible), price (numeric). If not present, leave empty. Return as JSON.
            
Message: "${message.text}"`;

          const model = genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: isDirectCommand ? {
                type: Type.OBJECT,
                properties: {
                  intent: { type: Type.STRING },
                  task: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      deadline: { type: Type.STRING },
                      price: { type: Type.NUMBER }
                    }
                  },
                  reply: { type: Type.STRING }
                }
              } : {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  deadline: { type: Type.STRING },
                  price: { type: Type.NUMBER }
                }
              }
            }
          });
          const response = await model;
          extractedData = JSON.parse(response.text || "{}");
        } catch (err) {
          console.error("Gemini analysis failed, falling back to regex", err);
        }
      }

      // Fallback or if Gemini failed
      if (!extractedData || (isDirectCommand && !extractedData.intent)) {
        const priceMatch = message.text.match(/\$(\d+)/) || message.text.match(/(\d+)\s*dollars/i);
        const price = priceMatch ? parseInt(priceMatch[1]) : 0;
        
        const deadlineMatch = message.text.match(/by\s+(friday|tomorrow|in\s+\d+\s+days)/i);
        let deadline = "";
        if (deadlineMatch) {
            deadline = format(addDays(new Date(), 3), "yyyy-MM-dd"); // rough fallback
        }

        if (isDirectCommand) {
          if (price > 0 && message.text.length > 15) {
             extractedData = { intent: "create_task", task: { title: message.text.replace(/@flow ai|hi flow ai/ig, "").trim().substring(0, 50), price, deadline: deadline || format(addDays(new Date(), 3), "yyyy-MM-dd") } };
          } else {
             extractedData = { intent: "ask_question", reply: "I can help create a task! Please provide a title, price, and deadline." };
          }
        } else {
          extractedData = {
            title: message.text.substring(0, 50),
            price: price,
            deadline: deadline
          };
        }
      }

      if (isDirectCommand) {
        if (extractedData.intent === "create_task" && extractedData.task) {
          // Create task directly
          let deadline = extractedData.task.deadline;
          if (deadline && !isValid(parseISO(deadline))) {
            deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
          } else if (!deadline) {
            deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
          }

          setNewTask({
            title: extractedData.task.title || "New Task",
            description: "Created by Flow AI",
            deadline: deadline,
            price: extractedData.task.price || 0,
          });
          setShowTaskModal(true);
          toast.success("Flow AI drafted a task for you!");
        } else if (extractedData.intent === "ask_question" && extractedData.reply) {
          // Send AI reply
          await addDoc(collection(db, "threads", threadId, "messages"), {
            text: extractedData.reply,
            senderId: "system",
            senderName: "Flow AI",
            senderPhoto: "https://ui-avatars.com/api/?name=Flow+AI&background=6366f1&color=fff",
            createdAt: Timestamp.now(),
            threadId: threadId,
          });
        }
      } else {
        setSuggestion({
          messageId: message.id,
          title: extractedData.title || message.text.substring(0, 50),
          description: message.text,
          price: extractedData.price || 0,
          deadline: extractedData.deadline || format(addDays(new Date(), 3), "yyyy-MM-dd")
        });
      }
    } catch (err) {
      console.error("Analysis error", err);
    } finally {
      setAnalyzingMessageId(null);
    }
  };

  const handleApplySuggestion = () => {
    if (!suggestion) return;
    
    let deadline = suggestion.deadline;
    // Basic validation of deadline
    if (deadline && !isValid(parseISO(deadline))) {
      deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
    } else if (!deadline) {
      deadline = format(addDays(new Date(), 3), "yyyy-MM-dd");
    }

    setNewTask({
      title: suggestion.title,
      description: suggestion.description,
      deadline: deadline,
      price: suggestion.price,
    });
    setShowTaskModal(true);
    setSuggestion(null);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !auth.currentUser || !threadId) return;

    const uid = auth.currentUser.uid;
    const msg = {
      text: inputText,
      type: "text" as const,
      senderId: uid,
      senderName: auth.currentUser.displayName || "User",
      senderPhoto: auth.currentUser.photoURL || "",
      createdAt: Timestamp.now(),
      threadId: threadId,
      seenBy: [uid],
    };

    try {
      console.log("[Chat] Sending message:", msg);
      const msgRef = await addDoc(collection(db, "threads", threadId, "messages"), msg);
      await updateDoc(doc(db, "threads", threadId), {
        lastMessage: inputText,
        updatedAt: Timestamp.now(),
      });
      
      // Add to timeline
      await addTimelineEvent({
        type: 'message',
        title: `New message from ${auth.currentUser.displayName}`,
        description: inputText.length > 50 ? inputText.substring(0, 50) + "..." : inputText,
        metadata: { messageId: msgRef.id, senderId: uid },
        timestamp: Timestamp.now(),
        userId: uid
      });

      // Create notification for other participant
      const otherId = thread?.participants?.find((id: string) => id !== uid);
      if (otherId) {
        await addDoc(collection(db, "users", otherId, "notifications"), {
          userId: otherId,
          title: `New message from ${auth.currentUser.displayName}`,
          message: inputText.length > 50 ? inputText.substring(0, 50) + "..." : inputText,
          type: "message",
          link: `/threads/${threadId}`,
          read: false,
          createdAt: Timestamp.now()
        });
      }

      setInputText("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `threads/${threadId}/messages`);
      setError("Failed to send message.");
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("Please enter a milestone title.");
      return;
    }
    if (newTask.price <= 0) {
      toast.error("Please enter a valid price.");
      return;
    }
    if (!auth.currentUser || !threadId || !thread) {
      toast.error("Missing required information to create task.");
      return;
    }
    
    setIsSubmitting(true);

    const clientId = thread.clientId;
    const freelancerId = thread.freelancerId;

    if (!clientId || !freelancerId) {
      toast.error("Cannot create task because the chat is missing client or freelancer. Please create a new chat from a project.");
      setIsSubmitting(false);
      return;
    }

    const uid = auth.currentUser.uid;
    
    // Parse deadline string to Timestamp
    let deadlineTimestamp: Timestamp;
    try {
      const date = new Date(newTask.deadline);
      if (isNaN(date.getTime())) {
        deadlineTimestamp = Timestamp.fromDate(addDays(new Date(), 7));
      } else {
        deadlineTimestamp = Timestamp.fromDate(date);
      }
    } catch (e) {
      deadlineTimestamp = Timestamp.fromDate(addDays(new Date(), 7));
    }

    const taskData: Omit<Task, 'id'> = {
      title: newTask.title.trim(),
      description: newTask.description.trim() || "No description provided.",
      deadline: deadlineTimestamp,
      price: Number(newTask.price),
      status: "pending",
      threadId: threadId,
      creatorId: uid,
      clientId: clientId,
      freelancerId: freelancerId,
      createdAt: Timestamp.now(),
    };

    console.log("[handleCreateTask] Saving task data:", taskData);

    try {
      const docRef = await addDoc(collection(db, "threads", threadId, "tasks"), taskData);
      console.log("[handleCreateTask] Task created with ID:", docRef.id);
      
      // Add to timeline
      await addTimelineEvent({
        type: 'task_created',
        title: `New milestone created: ${newTask.title}`,
        description: newTask.description,
        metadata: { taskId: docRef.id, price: newTask.price, deadline: newTask.deadline },
        timestamp: Timestamp.now(),
        userId: uid
      });

      // Create notification for other participant
      const otherId = thread?.participants?.find((id: string) => id !== uid);
      if (otherId) {
        try {
          await addDoc(collection(db, "users", otherId, "notifications"), {
            userId: otherId,
            title: "New Milestone Created",
            message: `A new milestone "${newTask.title}" has been added.`,
            type: "task_created",
            link: `/threads/${threadId}`,
            read: false,
            createdAt: Timestamp.now()
          });
        } catch (notifErr) {
          console.error("Failed to send notification", notifErr);
        }
      }

      toast.success("Milestone created successfully!");
      setShowTaskModal(false);
      setNewTask({ title: "", description: "", deadline: format(new Date(), "yyyy-MM-dd"), price: 0 });
    } catch (err) {
      console.error("[handleCreateTask] Error creating task:", err);
      handleFirestoreError(err, OperationType.CREATE, `threads/${threadId}/tasks`);
      toast.error("Failed to create task. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliverWork = async (taskId: string, url: string) => {
    if (!threadId || !taskId || !url) return;

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      toast.error("Please provide a valid URL starting with http:// or https://");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "delivered",
        deliveryUrl: url,
        deliveryType: "url",
        deliveryFileName: "External Link",
      });

      // Add to timeline
      await addTimelineEvent({
        type: 'task_status_changed',
        title: 'Work delivered',
        description: 'Freelancer delivered work via URL.',
        metadata: { taskId: taskId, url: url, status: 'delivered' },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });

      // Create notification for other participant
      const otherId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
      if (otherId) {
        await addDoc(collection(db, "users", otherId, "notifications"), {
          userId: otherId,
          title: "Work Delivered",
          message: "The freelancer has delivered work for a milestone via URL.",
          type: "delivery",
          link: `/threads/${threadId}`,
          read: false,
          createdAt: Timestamp.now(),
        });
      }

      toast.success("Work delivered successfully!");
      setShowDeliverModal(null);
      setDeliveryUrl("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      setError("Failed to submit delivery.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVotePaymentMethod = async (taskId: string, method: string) => {
    if (!threadId || !taskId || !userProfile) return;
    setIsSubmitting(true);
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const isClient = userProfile.role === "client";
      const updateData: any = {};
      
      if (isClient) {
        updateData.clientVote = method;
      } else {
        updateData.freelancerVote = method;
      }

      // Check if both have voted and they match
      const otherVote = isClient ? task.freelancerVote : task.clientVote;
      
      if (otherVote === method) {
        updateData.paymentMethod = method;
        updateData.status = "waiting_payment_details";
      }

      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), updateData);

      if (otherVote === method) {
        await addTimelineEvent({
          type: 'task_status_changed',
          title: 'Payment method agreed',
          description: `Both parties agreed on ${method} as payment method.`,
          metadata: { taskId, paymentMethod: method, status: 'waiting_payment_details' },
          timestamp: Timestamp.now(),
          userId: auth.currentUser?.uid || ''
        });
        toast.success(`Payment method ${method} agreed upon.`);
      } else {
        toast.success(`Voted for ${method}. Waiting for other party.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to vote for payment method.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPaymentDetails = async (taskId: string) => {
    if (!threadId || !taskId || !freelancerPaymentDetails.trim()) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        freelancerPaymentDetails: freelancerPaymentDetails.trim(),
        status: "waiting_client_confirmation",
      });

      await addTimelineEvent({
        type: 'task_status_changed',
        title: 'Payment details submitted',
        description: 'Freelancer submitted payment account details.',
        metadata: { taskId, status: 'waiting_client_confirmation' },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });

      toast.success("Payment details submitted.");
      setFreelancerPaymentDetails("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to submit payment details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClientConfirmPayment = async (taskId: string) => {
    if (!threadId || !taskId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "waiting_freelancer_confirmation",
      });

      await addTimelineEvent({
        type: 'payment',
        title: 'Payment sent',
        description: 'Client confirmed they have sent the payment.',
        metadata: { taskId, status: 'waiting_freelancer_confirmation' },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });

      toast.success("Payment confirmed. Waiting for freelancer to verify.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to confirm payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFreelancerConfirmPayment = async (taskId: string) => {
    if (!threadId || !taskId || !thread) return;
    setIsSubmitting(true);
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "in_progress",
        paidAt: Timestamp.now(),
      });

      // Create transaction record
      await addDoc(collection(db, "transactions"), {
        taskId,
        amount: task.price,
        fee: 0, // Manual payment, no platform fee for now
        status: "completed",
        fromId: task.clientId,
        toId: task.freelancerId,
        createdAt: Timestamp.now(),
      });

      await addTimelineEvent({
        type: 'payment',
        title: 'Payment received',
        description: 'Freelancer confirmed receipt of payment.',
        metadata: { taskId, status: 'in_progress' },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });

      toast.success("Payment received. Milestone is now in progress.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to confirm payment receipt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFreelancerDisputePayment = async (taskId: string) => {
    if (!threadId || !taskId || !thread) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "disputed",
      });

      await addTimelineEvent({
        type: 'task_status_changed',
        title: 'Payment disputed',
        description: 'Freelancer reported they did not receive the payment.',
        metadata: { taskId, status: 'disputed' },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });

      if (thread.clientId) {
        const clientDocRef = doc(db, "users", thread.clientId);
        const clientDoc = await getDoc(clientDocRef);
        if (clientDoc.exists()) {
          const currentCount = clientDoc.data().disputeCount || 0;
          const newCount = currentCount + 1;
          await updateDoc(clientDocRef, {
            disputeCount: newCount,
            banned: newCount >= 3 ? true : clientDoc.data().banned || false
          });
        }
      }

      toast.error("Payment disputed. Admin will review the case.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to dispute payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportIssue = async (taskId: string) => {
    if (!threadId || !taskId || !thread || !userProfile) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "disputed",
      });

      await addTimelineEvent({
        type: 'task_status_changed',
        title: 'Task disputed',
        description: `${userProfile.role === 'client' ? 'Client' : 'Freelancer'} reported an issue.`,
        metadata: { taskId, status: 'disputed' },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });

      const otherUserId = userProfile.role === "client" ? thread.freelancerId : thread.clientId;
      if (otherUserId) {
        const otherDocRef = doc(db, "users", otherUserId);
        const otherDoc = await getDoc(otherDocRef);
        if (otherDoc.exists()) {
          const currentCount = otherDoc.data().disputeCount || 0;
          const newCount = currentCount + 1;
          await updateDoc(otherDocRef, {
            disputeCount: newCount,
            banned: newCount >= 3 ? true : otherDoc.data().banned || false
          });
        }
      }

      toast.error("Issue reported. Admin will review the case.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to report issue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteWork = async (taskId: string) => {
    if (!threadId || !taskId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "threads", threadId, "tasks", taskId), {
        status: "completed",
        completedAt: Timestamp.now(),
      });
      
      // Add to timeline
      await addTimelineEvent({
        type: 'milestone_achieved',
        title: 'Milestone completed',
        description: 'Client approved and completed the milestone.',
        metadata: { taskId: taskId, status: 'completed' },
        timestamp: Timestamp.now(),
        userId: auth.currentUser?.uid || ''
      });

      const otherId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
      if (otherId) {
        await addDoc(collection(db, "users", otherId, "notifications"), {
          userId: otherId,
          title: "Task Completed",
          message: "The client has approved and completed the task.",
          type: "completion",
          link: `/threads/${threadId}`,
          read: false,
          createdAt: Timestamp.now()
        });
      }
      setShowCompleteModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `threads/${threadId}/tasks/${taskId}`);
      setError("Failed to complete task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!showRatingModal || ratingStars === 0 || !userProfile || !thread) return;
    setIsSubmitting(true);
    try {
      const task = tasks.find(t => t.id === showRatingModal);
      if (!task) return;

      const ratedUserId = userProfile.role === "client" ? task.freelancerId : task.clientId;

      // Add rating document
      await addDoc(collection(db, "ratings"), {
        raterId: auth.currentUser?.uid,
        ratedUserId,
        taskId: task.id,
        stars: ratingStars,
        createdAt: Timestamp.now(),
      });

      // Recalculate average rating
      const ratingsQuery = query(collection(db, "ratings"), where("ratedUserId", "==", ratedUserId));
      const ratingsSnapshot = await getDocs(ratingsQuery);
      let totalStars = 0;
      let count = 0;
      ratingsSnapshot.forEach(doc => {
        totalStars += doc.data().stars;
        count++;
      });
      
      const newAverage = count > 0 ? totalStars / count : 0;

      // Update user document
      await updateDoc(doc(db, "users", ratedUserId), {
        rating: newAverage,
        ratingCount: count,
      });

      toast.success("Rating submitted successfully!");
      setShowRatingModal(null);
      setRatingStars(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ratings`);
      toast.error("Failed to submit rating.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!threadId || !taskId) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "threads", threadId, "tasks", taskId));
      toast.success("Task deleted.");
      setShowDeleteTaskModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `threads/${threadId}/tasks/${taskId}`);
      toast.error("Failed to delete task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllTasks = async () => {
    if (!threadId) return;
    setIsSubmitting(true);
    try {
      for (const task of tasks) {
        await deleteDoc(doc(db, "threads", threadId, "tasks", task.id));
      }
      toast.success("All tasks deleted.");
      setShowDeleteAllTasksModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete all tasks.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShowParticipantProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setSelectedParticipant(userDoc.data() as UserProfile);
        setShowParticipantModal(true);
      }
    } catch (err) {
      console.error("Error fetching participant profile", err);
      toast.error("Failed to load profile.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!threadId) return;
    console.log(`[Chat] Deleting message: ${messageId}`);
    try {
      await deleteDoc(doc(db, "threads", threadId, "messages", messageId));
      toast.success("Message deleted");
    } catch (err) {
      console.error("Error deleting message", err);
      toast.error("Failed to delete message");
    }
  };

  const handleEditMessage = async () => {
    if (!threadId || !editingMessageId || !editText.trim()) return;
    console.log(`[Chat] Editing message: ${editingMessageId}`);
    try {
      await updateDoc(doc(db, "threads", threadId, "messages", editingMessageId), {
        text: editText,
        edited: true,
      });
      setEditingMessageId(null);
      setEditText("");
      toast.success("Message updated");
    } catch (err) {
      console.error("Error editing message", err);
      toast.error("Failed to update message");
    }
  };

  const combinedItems = [
    ...messages.map((m) => ({ ...m, itemType: "message" as const })),
    ...tasks.map((t) => ({ ...t, itemType: "task" as const })),
  ].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="mb-4 text-4xl">🔍</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">{error}</h2>
        <button
          onClick={() => navigate("/threads")}
          className="mt-4 rounded-xl bg-indigo-600 px-6 py-2 font-bold text-white transition-all active:scale-95"
        >
          Back to Threads
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex h-16 items-center border-b border-gray-100 bg-white/80 px-4 sm:px-6 backdrop-blur-md">
        <button onClick={() => navigate("/threads")} className="mr-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={24} />
        </button>
        <div 
          className="flex-1 cursor-pointer"
          onClick={() => {
            const otherId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
            if (otherId) handleShowParticipantProfile(otherId);
          }}
        >
          <h2 className="font-bold text-gray-900">{thread?.title || "Chat"}</h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">View Profile</p>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-100 bg-white">
        <button
          onClick={() => setActiveTab("chat")}
          className={clsx(
            "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
            activeTab === "chat" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare size={14} />
            Chat
          </div>
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={clsx(
            "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
            activeTab === "timeline" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <History size={14} />
            Timeline
          </div>
        </button>
      </div>

      {/* Messages Area */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-gray-50 bg-white flex gap-2 overflow-x-auto no-scrollbar">
            {(["all", "pending", "waiting_payment_details", "waiting_client_confirmation", "waiting_freelancer_confirmation", "in_progress", "delivered", "completed", "disputed"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTaskFilter(filter)}
                className={clsx(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                  taskFilter === filter
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                )}
              >
                {filter.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
          {combinedItems
            .filter(item => {
              if (item.itemType === 'message') return true;
              if (taskFilter === 'all') return true;
              return item.status === taskFilter;
            })
            .map((item) => {
          if (item.itemType === "message") {
            const isMe = item.senderId === auth.currentUser?.uid;
            const otherParticipantId = thread?.participants?.find((id: string) => id !== auth.currentUser?.uid);
            const isSeenByOther = item.seenBy?.includes(otherParticipantId);

            return (
              <div key={item.id} className={clsx("flex flex-col group", isMe ? "items-end" : "items-start")}>
                <div className="flex items-center gap-2">
                  {!isMe && (
                    <img 
                      src={item.senderPhoto || `https://ui-avatars.com/api/?name=${item.senderName}&background=6366f1&color=fff`} 
                      alt={item.senderName} 
                      className="h-6 w-6 rounded-full object-cover cursor-pointer"
                      onClick={() => handleShowParticipantProfile(item.senderId)}
                    />
                  )}

                  {isMe && (
                    <div className="relative">
                      <button 
                        onClick={() => setShowMsgMenuId(showMsgMenuId === item.id ? null : item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-all"
                      >
                        <MoreVertical size={14} />
                      </button>
                      
                      {showMsgMenuId === item.id && (
                        <div className="absolute right-0 bottom-full mb-2 z-10 w-24 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
                          <button 
                            onClick={() => {
                              setEditingMessageId(item.id);
                              setEditText(item.text);
                              setShowEditMsgModal(true);
                              setShowMsgMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                          <button 
                            onClick={() => {
                              handleDeleteMessage(item.id);
                              setShowMsgMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className={clsx(
                      "relative max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm break-words",
                      isMe
                        ? "chat-bubble-right bg-indigo-600 text-white"
                        : "chat-bubble-left bg-gray-100 text-gray-900"
                    )}
                  >
                    {item.type === "voice" || item.voiceUrl ? (
                      <div className="flex flex-col gap-1 py-1">
                        <div className="flex items-center gap-2">
                          <audio src={item.fileUrl || item.voiceUrl} controls className="h-8 max-w-[200px]" />
                        </div>
                        {item.duration && (
                          <span className={clsx("text-[10px]", isMe ? "text-white/60" : "text-gray-500")}>
                            {Math.floor(item.duration / 60)}:
                            {Math.floor(item.duration % 60)
                              .toString()
                              .padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    ) : item.type === "file" || item.fileUrl ? (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 hover:underline"
                      >
                        <FileText size={16} />
                        <span className="truncate max-w-[150px]">{item.fileName || "Attachment"}</span>
                      </a>
                    ) : (
                      <div className="flex flex-col">
                        <span>{item.text}</span>
                        {item.edited && (
                          <span className={clsx("text-[9px] mt-0.5 opacity-60 italic", isMe ? "text-right" : "text-left")}>
                            edited
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex items-center gap-1.5 px-1">
                  <span className="text-[9px] text-gray-400">
                    {format(item.createdAt.toDate(), "HH:mm")}
                  </span>
                  {isMe && (
                    <div className="text-indigo-400">
                      {isSeenByOther ? <CheckCheck size={12} /> : <Check size={12} />}
                    </div>
                  )}
                </div>
                
                {/* AI Suggestion Chip */}
                {isParticipant && suggestion?.messageId === item.id && userProfile?.role === "client" && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleApplySuggestion}
                    className="mt-2 flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-[10px] font-bold text-indigo-600 shadow-sm hover:bg-indigo-100 transition-all"
                  >
                    <Sparkles size={12} />
                    Create task from this message?
                  </motion.button>
                )}

                {analyzingMessageId === item.id && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 italic">
                    <Loader2 size={10} className="animate-spin" />
                    Analyzing request...
                  </div>
                )}
              </div>
            );
          } else {
            return (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={item.id}
                className="mx-auto w-full max-w-xs rounded-2xl border border-gray-100 bg-white p-4 shadow-lg relative"
              >
                {isParticipant && item.creatorId === auth.currentUser?.uid && (
                  <button
                    onClick={() => setShowDeleteTaskModal(item.id)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {isParticipant && item.status !== "completed" && item.status !== "disputed" && item.status !== "pending" && (
                  <button
                    onClick={() => handleReportIssue(item.id)}
                    className="absolute top-4 right-10 text-gray-300 hover:text-red-500 transition-colors"
                    title="Report Issue"
                  >
                    <AlertTriangle size={16} />
                  </button>
                )}
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    Task
                  </span>
                  <span className={clsx(
                    "text-[10px] font-bold uppercase",
                    item.status === "in_progress" ? "text-emerald-500" : 
                    item.status === "delivered" ? "text-blue-500" :
                    item.status === "completed" ? "text-purple-500" : 
                    item.status === "waiting_freelancer_confirmation" ? "text-green-500" :
                    item.status === "waiting_client_confirmation" ? "text-indigo-500" :
                    item.status === "disputed" ? "text-red-500" :
                    item.status === "waiting_payment_details" ? "text-orange-500" : "text-amber-500"
                  )}>
                    {item.status.replace(/_/g, " ")}
                  </span>
                </div>
                <h3 className="mb-1 font-bold text-gray-900">{item.title}</h3>
                <p className="mb-4 text-xs text-gray-500">{item.description}</p>
                <div className="mb-4 flex items-center justify-between text-xs font-medium text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {item.deadline instanceof Timestamp 
                      ? format(item.deadline.toDate(), "MMM d, yyyy") 
                      : item.deadline}
                  </div>
                  <div className="flex items-center gap-1 text-gray-900">
                    <DollarSign size={14} />
                    {item.price}
                  </div>
                </div>

                {isParticipant && item.status === "pending" && thread?.clientId && thread?.freelancerId && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Vote for Payment Method</p>
                    <div className="relative">
                      <select
                        value={userProfile?.role === "client" ? item.clientVote || "" : item.freelancerVote || ""}
                        onChange={(e) => handleVotePaymentMethod(item.id, e.target.value)}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-[10px] font-bold text-gray-700 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500 appearance-none"
                      >
                        <option value="" disabled>Select Payment Method</option>
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                      <span>Client Vote: <strong className="text-gray-900">{item.clientVote || "Waiting..."}</strong></span>
                      <span>Freelancer Vote: <strong className="text-gray-900">{item.freelancerVote || "Waiting..."}</strong></span>
                    </div>
                  </div>
                )}

                {isParticipant && item.status === "waiting_payment_details" && (
                  <div className="mt-4 rounded-xl bg-indigo-50 p-3 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-900">Method: {item.paymentMethod}</span>
                    </div>
                    {userProfile?.role === "freelancer" ? (
                      <div className="space-y-2">
                        <p className="text-[10px] text-indigo-700">Enter your {item.paymentMethod} details:</p>
                        <textarea
                          value={freelancerPaymentDetails}
                          onChange={(e) => setFreelancerPaymentDetails(e.target.value)}
                          placeholder="Account #, Name, etc."
                          className="w-full rounded-lg border-none bg-white p-2 text-[10px] outline-none ring-1 ring-indigo-200 focus:ring-2 focus:ring-indigo-500"
                          rows={2}
                        />
                        <button
                          onClick={() => handleSubmitPaymentDetails(item.id)}
                          disabled={isSubmitting || !freelancerPaymentDetails.trim()}
                          className="w-full rounded-lg bg-indigo-600 py-2 text-[10px] font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Submit Details
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-indigo-600 italic">Waiting for freelancer details...</p>
                    )}
                  </div>
                )}

                {isParticipant && item.status === "waiting_client_confirmation" && (
                  <div className="mt-4 rounded-xl bg-indigo-50 p-3 border border-indigo-100">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-bold text-indigo-900">Method: {item.paymentMethod}</span>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-indigo-100">
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Freelancer Details:</p>
                        <p className="text-[10px] text-gray-900 whitespace-pre-wrap">{item.freelancerPaymentDetails}</p>
                      </div>
                      {userProfile?.role === "client" ? (
                        <button
                          onClick={() => handleClientConfirmPayment(item.id)}
                          disabled={isSubmitting}
                          className="w-full rounded-lg bg-indigo-600 py-2 text-[10px] font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                          I have paid (confirm payment)
                        </button>
                      ) : (
                        <p className="text-[10px] text-indigo-600 italic">Waiting for client to confirm payment...</p>
                      )}
                    </div>
                  </div>
                )}

                {isParticipant && item.status === "waiting_freelancer_confirmation" && (
                  <div className="mt-4 rounded-xl bg-green-50 p-3 border border-green-100">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-[10px] font-bold text-green-900">Payment Sent</span>
                      </div>
                      {userProfile?.role === "freelancer" ? (
                        <div className="space-y-2">
                          <p className="text-[10px] text-green-700">Verify payment and confirm:</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleFreelancerConfirmPayment(item.id)}
                              disabled={isSubmitting}
                              className="flex-1 rounded-lg bg-green-600 py-2 text-[10px] font-bold text-white shadow-sm hover:bg-green-700 transition-all"
                            >
                              ✅ I received payment
                            </button>
                            <button
                              onClick={() => handleFreelancerDisputePayment(item.id)}
                              disabled={isSubmitting}
                              className="flex-1 rounded-lg bg-red-600 py-2 text-[10px] font-bold text-white shadow-sm hover:bg-red-700 transition-all"
                            >
                              ❌ I did not receive payment
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-green-600 italic">Waiting for freelancer confirmation...</p>
                      )}
                    </div>
                  </div>
                )}

                {isParticipant && userProfile?.role === "freelancer" && item.status === "in_progress" && (
                  <button
                    onClick={() => setShowDeliverModal(item.id)}
                    className="mt-4 w-full rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white transition-all active:scale-95"
                  >
                    Deliver Work
                  </button>
                )}

                {isParticipant && userProfile?.role === "client" && item.status === "delivered" && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setShowCompleteModal(item.id)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white transition-all active:scale-95"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReportIssue(item.id)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-50 py-2 text-sm font-bold text-red-600 hover:bg-red-100 transition-all active:scale-95"
                    >
                      <AlertTriangle size={16} />
                      Report Issue
                    </button>
                  </div>
                )}

                {isParticipant && item.status === "delivered" && userProfile?.role === "freelancer" && (
                  <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-xl bg-gray-50 py-2 px-4 text-sm font-bold text-gray-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-blue-500" />
                      Delivered
                      {item.deliveryUrl && (
                        <a href={item.deliveryUrl} target="_blank" rel="noreferrer" className="text-indigo-600">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    {item.deliveryFileName && (
                      <span className="text-[10px] text-gray-400 font-normal truncate max-w-full">
                        {item.deliveryFileName}
                      </span>
                    )}
                  </div>
                )}
                
                {item.status === "completed" && (
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-purple-50 py-2 px-4 text-sm font-bold text-purple-700">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-purple-500" />
                        Completed
                        {item.deliveryUrl && (
                          <a href={item.deliveryUrl} target="_blank" rel="noreferrer" className="text-indigo-600">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      {item.deliveryFileName && (
                        <span className="text-[10px] text-purple-400 font-normal truncate max-w-full">
                          {item.deliveryFileName}
                        </span>
                      )}
                    </div>
                    {isParticipant && !hasRatedTasks[item.id] && (
                      <button
                        onClick={() => setShowRatingModal(item.id)}
                        className="w-full rounded-lg bg-yellow-500 py-2 text-[10px] font-bold text-white shadow-sm hover:bg-yellow-600 transition-all flex items-center justify-center gap-2"
                      >
                        <Star className="w-4 h-4" />
                        Rate {userProfile?.role === "client" ? "Freelancer" : "Client"}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          }
        })}
          <div ref={scrollRef} />
        </div>
      </div>
      )}

      {/* Timeline Area */}
      {activeTab === "timeline" && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar bg-gray-50/30">
          {isParticipant && userProfile?.role === "freelancer" && (
            <div className="mb-6 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600">Post Update</h4>
              <textarea
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="What's the latest update on the project?"
                className="w-full resize-none rounded-xl border-none bg-gray-50 p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handlePostUpdate}
                  disabled={isSubmitting || !updateText.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : "Post Update"}
                </button>
              </div>
            </div>
          )}

          <div className="relative space-y-8 before:absolute before:left-4 before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-gray-200">
            {timelineEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-gray-100 p-4 text-gray-400">
                  <History size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-900">No events yet</h3>
                <p className="text-xs text-gray-500">Project milestones and updates will appear here.</p>
              </div>
            ) : (
              timelineEvents.map((event) => (
                <div key={event.id} className="relative pl-10">
                  <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-indigo-600 text-white shadow-sm">
                    {event.type === 'message' && <MessageSquare size={14} />}
                    {event.type === 'task_created' && <Plus size={14} />}
                    {event.type === 'task_status_changed' && <Check size={14} />}
                    {event.type === 'payment' && <DollarSign size={14} />}
                    {event.type === 'freelancer_update' && <Edit2 size={14} />}
                    {event.type === 'milestone_achieved' && <CheckCircle2 size={14} />}
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900">{event.title}</h4>
                      <span className="text-[10px] text-gray-400">
                        {event.timestamp instanceof Timestamp 
                          ? format(event.timestamp.toDate(), "MMM d, HH:mm")
                          : "Just now"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{event.description}</p>
                    {event.metadata?.price && (
                      <div className="mt-2 text-[10px] font-bold text-indigo-600">
                        Budget: ${event.metadata.price}
                      </div>
                    )}
                    {event.metadata?.url && (
                      <a 
                        href={event.metadata.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        <ExternalLink size={10} />
                        View Delivery
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      {activeTab === "chat" && isParticipant && (
      <div className="border-t border-gray-100 p-4 sm:p-6 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all active:scale-90"
          >
            <Plus size={20} />
          </button>
          
          <form onSubmit={handleSendMessage} className="flex flex-1 items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={userProfile?.role === "client" ? "Add Milestone or message..." : "Type a message..."}
                className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            <button
              type="submit"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white transition-all active:scale-90 disabled:opacity-50"
              disabled={!inputText.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
      )}

      {/* Participant Profile Modal */}
      <AnimatePresence>
        {showParticipantModal && selectedParticipant && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm overflow-hidden rounded-[32px] bg-white shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="relative h-24 bg-indigo-600">
                <button 
                  onClick={() => setShowParticipantModal(false)}
                  className="absolute right-4 top-4 rounded-full bg-black/20 p-1.5 text-white backdrop-blur-md hover:bg-black/40 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="relative -mt-12 flex flex-col items-center px-8 pb-8 text-center">
                <img
                  src={selectedParticipant.photoURL || `https://ui-avatars.com/api/?name=${selectedParticipant.displayName}&background=6366f1&color=fff`}
                  alt={selectedParticipant.displayName}
                  className="mb-4 h-24 w-24 rounded-[32px] border-4 border-white object-cover shadow-xl"
                />
                <h3 className="text-xl font-bold text-gray-900 flex items-center justify-center gap-2">
                  {selectedParticipant.displayName}
                  {selectedParticipant.rating !== undefined && (
                    <span className="flex items-center text-sm font-bold text-yellow-500 bg-yellow-50 px-2 py-0.5 rounded-full">
                      ★ {selectedParticipant.rating.toFixed(1)} <span className="text-yellow-600/60 ml-1 text-xs">({selectedParticipant.ratingCount || 0})</span>
                    </span>
                  )}
                </h3>
                <p className="mb-1 text-sm text-gray-500">{selectedParticipant.email}</p>
                <span className="mb-4 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {selectedParticipant.role}
                </span>

                {selectedParticipant.role === "freelancer" ? (
                  <div className="w-full space-y-4">
                    {selectedParticipant.location && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={14} className="text-gray-400" />
                        {selectedParticipant.location}
                      </div>
                    )}
                    
                    {selectedParticipant.bio && (
                      <p className="text-sm text-gray-600 line-clamp-3">{selectedParticipant.bio}</p>
                    )}

                    {selectedParticipant.skills && selectedParticipant.skills.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {selectedParticipant.skills.map(skill => (
                          <span key={skill} className="rounded-lg bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-500 ring-1 ring-gray-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {selectedParticipant.portfolioUrl && (
                      <a 
                        href={selectedParticipant.portfolioUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition-all active:scale-95"
                      >
                        <Globe size={18} />
                        View Portfolio
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Project Client</p>
                )}
                
                <button
                  onClick={() => setShowParticipantModal(false)}
                  className="mt-6 w-full rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Add Milestone</h3>
                <button onClick={() => setShowTaskModal(false)} className="text-gray-400">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Milestone Title</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="E.g. Logo Design"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Description</label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="Details about the work..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Deadline</label>
                    <input
                      type="date"
                      value={newTask.deadline}
                      onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                      className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Price ($)</label>
                    <input
                      type="number"
                      value={newTask.price}
                      onChange={(e) => setNewTask({ ...newTask, price: Number(e.target.value) })}
                      className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateTask}
                  disabled={isSubmitting || !newTask.title.trim()}
                  className="mt-4 flex w-full items-center justify-center rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Add Milestone"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delivery Modal */}
      <AnimatePresence>
        {showDeliverModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Deliver Work</h3>
                <button onClick={() => setShowDeliverModal(null)} className="text-gray-400">
                  <X size={24} />
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-500">
                Provide a link to your completed work. The client will be notified.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Delivery URL</label>
                  <input
                    type="url"
                    value={deliveryUrl}
                    onChange={(e) => setDeliveryUrl(e.target.value)}
                    placeholder="https://example.com/your-work"
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => handleDeliverWork(showDeliverModal, deliveryUrl)}
                  disabled={isSubmitting || !deliveryUrl.trim()}
                  className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Submit Delivery"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complete Modal */}
      <AnimatePresence>
        {showCompleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Approve Completion?</h3>
              <p className="mb-6 text-sm text-gray-500">
                Approve and mark task as completed? This will notify the freelancer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteModal(null)}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCompleteWork(showCompleteModal)}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Approve"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                <Star size={24} className="fill-yellow-500" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Rate {userProfile?.role === "client" ? "Freelancer" : "Client"}</h3>
              <p className="mb-6 text-sm text-gray-500">
                How was your experience working with them?
              </p>
              
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingStars(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      size={32}
                      className={clsx(
                        "transition-colors",
                        star <= ratingStars ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRatingModal(null);
                    setRatingStars(0);
                  }}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRating}
                  disabled={isSubmitting || ratingStars === 0}
                  className="flex-1 flex items-center justify-center rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Submit"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Task Modal */}
      <AnimatePresence>
        {showDeleteTaskModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={24} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Delete Task?</h3>
              <p className="mb-6 text-sm text-gray-500">
                Are you sure you want to delete this task? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteTaskModal(null)}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTask(showDeleteTaskModal)}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center rounded-xl bg-red-600 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Message Modal */}
      <AnimatePresence>
        {showEditMsgModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <h3 className="mb-4 text-lg font-bold text-gray-900">Edit Message</h3>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="mb-6 w-full rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-indigo-500"
                rows={3}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEditMsgModal(false);
                    setEditingMessageId(null);
                  }}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleEditMessage();
                    setShowEditMsgModal(false);
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all active:scale-95"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Tasks Modal */}
      <AnimatePresence>
        {showDeleteAllTasksModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 size={24} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Delete All Tasks?</h3>
              <p className="mb-6 text-sm text-gray-500">
                Are you sure you want to delete all tasks in this chat? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllTasksModal(false)}
                  className="flex-1 rounded-xl bg-gray-100 py-3 font-bold text-gray-600 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllTasks}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center rounded-xl bg-red-600 py-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Delete All"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
