"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPositionsCreateRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/hr/positions/create"); }, [router]);
  return null;
}
