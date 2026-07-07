"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";
import { useProfile, useMyAgents, useIdentityMutations, useAgentMutations } from "@/hooks/use-queries";
import type { MyAgentsResponse } from "@/types";

interface CredentialData {
  client_id: string;
  client_secret: string;
  status?: string;
}

export function useIdentityManager() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: myAgentsData, isLoading: agentsLoading } = useMyAgents();
  const identityMutations = useIdentityMutations();
  const agentMutations = useAgentMutations();

  const myAgents: MyAgentsResponse | undefined = myAgentsData as MyAgentsResponse | undefined;
  const agentsList = myAgents?.agents || [];

  const [credential, setCredential] = useState<CredentialData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBio, setEditBio] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");

  const [profileInitialized, setProfileInitialized] = useState(false);
  if (profile && !profileInitialized) {
    setEditName(profile.profile?.username || profile.name || "");
    setEditEmail(profile.profile?.email || "");
    setEditBio(profile.profile?.bio || "");
    setProfileInitialized(true);
  }

  const saveProfile = () => {
    identityMutations.updateProfile.mutate(
      { username: editName, email: editEmail, bio: editBio },
      {
        onSuccess: () => { showToast("资料已更新", "success"); setEditing(false); },
        onError: (err: Error) => showToast(`更新失败: ${err.message}`, "error"),
      }
    );
  };

  const getCredential = (agentId: string) => {
    identityMutations.agentCredentials.mutate(agentId, {
      onSuccess: (data: { client_id: string; client_secret: string; status?: string }) => {
        setCredential({ client_id: data.client_id, client_secret: data.client_secret, status: data.status });
        showToast("凭证已获取", "success");
      },
      onError: (err: Error) => showToast(`获取凭证失败: ${err.message}`, "error"),
    });
  };

  const bindAgent = (agentId: string) => {
    agentMutations.bindAgent.mutate(agentId, {
      onSuccess: (data: { client_id: string; client_secret: string; status?: string }) => {
        setCredential({ client_id: data.client_id, client_secret: data.client_secret, status: data.status });
        showToast("绑定成功，凭证已生成", "success");
      },
      onError: (err: Error) => showToast(`绑定失败: ${err.message}`, "error"),
    });
  };

  const deleteAgent = (agentId: string, agentName: string) => {
    if (!confirm(`确定删除 ${agentName}？此操作不可撤销。`)) return;
    agentMutations.deleteAgent.mutate(agentId, {
      onSuccess: () => showToast(`${agentName} 已删除`, "success"),
      onError: (err: Error) => showToast(`删除失败: ${err.message}`, "error"),
    });
  };

  const registerAgent = () => {
    if (!agentName.trim()) { showToast("请填写Agent名称", "error"); return; }
    agentMutations.registerAgent.mutate(
      { agent_id: `agent-${agentName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`, name: agentName, description: agentDesc, capabilities: [] },
      {
        onSuccess: (data: unknown) => {
          showToast("Agent注册成功", "success");
          setAgentName(""); setAgentDesc("");
          const result = data as { agent_id?: string };
          if (result?.agent_id) getCredential(result.agent_id);
        },
        onError: (err: Error) => showToast(`注册失败: ${err.message}`, "error"),
      }
    );
  };

  return {
    user, profile, profileLoading, agentsLoading,
    credential, editing, setEditing,
    editName, setEditName, editEmail, setEditEmail, editBio, setEditBio,
    agentName, setAgentName, agentDesc, setAgentDesc,
    agentsList, identityMutations, agentMutations,
    saveProfile, getCredential, bindAgent, deleteAgent, registerAgent, showToast,
  };
}
