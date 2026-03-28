"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPositionsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/hr/positions"); }, [router]);
  return null;
}
