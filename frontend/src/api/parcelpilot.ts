const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

export interface Citation {
  document: string;
  sourceType: string;
  documentId?: string | null;
  chunkId?: string | null;
  accountId?: string | null;
}

export interface PendingAction {
  type: string;
  targetId: string;
  createdAt: string;
  details?: any;
}

export interface AgentResponse {
  status: string;
  intent: string;
  answer: string;
  citations: Citation[];
  requiresConfirmation: boolean;
  pendingAction: PendingAction | null;
  missingInformation: any[];
  nextStep: string;
}

export interface ChatResponse {
  success: boolean;
  data: {
    conversationId: string;
    response: AgentResponse;
  };
  traceId: string;
}

export async function sendMessage(
  message: string,
  conversationId?: string,
  referenceTime?: string
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/parcelpilot/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversationId } : {}),
      ...(referenceTime ? { referenceTime } : {}),
    }),
  });

  if (!response.ok) {
    let errMessage = "Server error occurred";
    try {
      const errBody = await response.json();
      errMessage = errBody.message || errBody;
    } catch (_) {}
    throw new Error(errMessage);
  }

  return response.json();
}
