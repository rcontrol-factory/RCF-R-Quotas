import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { InsertJob, InsertJobItem, Job } from "@shared/schema";
import { z } from "zod";

type CreateJobInput = z.infer<typeof api.jobs.create.input>;
type UpdateJobInput = z.infer<typeof api.jobs.update.input>;

export interface JobsListResponse {
  items: Job[];
  stats: { total: number; drafts: number; sent: number; approved: number; inProgress: number; done: number };
}

export function useJobs() {
  return useQuery<JobsListResponse>({
    queryKey: [api.jobs.list.path],
    queryFn: async () => {
      const res = await fetch(api.jobs.list.path);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return await res.json();
    },
  });
}

export function useJob(id: number) {
  return useQuery({
    queryKey: [api.jobs.get.path, id],
    queryFn: async () => {
      if (isNaN(id)) return null;
      const url = buildUrl(api.jobs.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch job");
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateJobInput) => {
      const validated = api.jobs.create.input.parse(data);
      const res = await fetch(api.jobs.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create job");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
      toast({ title: "Success", description: "Job created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateJobInput) => {
      const url = buildUrl(api.jobs.update.path, { id });
      const validated = api.jobs.update.input.parse(data);
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!res.ok) throw new Error("Failed to update job");
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.jobs.get.path, data.id] });
      toast({ title: "Saved", description: "Job updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.jobs.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete job");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] });
      toast({ title: "Deleted", description: "Job removed successfully" });
    },
  });
}
