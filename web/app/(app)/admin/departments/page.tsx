"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDepartmentsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/hr/departments"); }, [router]);
  return null;
}
