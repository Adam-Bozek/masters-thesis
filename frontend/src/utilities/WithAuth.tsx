"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "./AuthContext";

type WithAuthProps = Record<string, unknown>;

const withAuth = <P extends WithAuthProps>(Wrapped: React.ComponentType<P>) => {
  const ComponentWithAuth = (props: P) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.replace("/");
      }
    }, [loading, user, router]);

    if (loading) return <p>Načítavam...</p>;

    return user ? <Wrapped {...props} /> : null;
  };

  return ComponentWithAuth;
};

export default withAuth;
