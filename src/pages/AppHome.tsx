import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { supabase } from "../lib/supabaseClient";

export default function AppHome() {
  const nav = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const e = data.session?.user.email;
      setEmail(e ?? "");
    });
  }, []);

  const onSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else {
      toast.success("Signed out");
      nav("/login");
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Hello world</h1>
      <p>Signed in as: {email || "(unknown)"}</p>
      <button onClick={onSignOut}>Sign out</button>
    </div>
  );
}
