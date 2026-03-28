"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function AdminPositionEditRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/hr/positions/${id}/edit`); }, [router, id]);
  return null;
}
