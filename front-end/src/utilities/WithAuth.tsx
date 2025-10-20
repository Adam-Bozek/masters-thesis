"use client";

import { useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";

type WithAuthProps = Record<string, unknown>;

const withAuth = <P extends WithAuthProps>(Wrapped: React.ComponentType<P>) => {
  const ComponentWithAuth = (props: P) => {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) router.replace("/");
    }, [loading, user, router]);

    if (loading) return <p>Loading...</p>;
    return user ? <Wrapped {...props} /> : null;
  };

  return ComponentWithAuth;
};

export default withAuth;
