import style from "./error.module.css";
import Link from "next/link";
export default function ErrorPage() {
  return <div className={style.page}><h1>Sorry, something went wrong</h1><p>Please try again or contact the store if the problem continues.</p><Link href="/login">Return to sign in</Link></div>
}

