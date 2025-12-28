import styles from "./privacy.module.css";

export default function Privacy() {
  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.updated}>Last updated: December 2025</p>

      <p>
        Thrift Barn Furniture respects your privacy and is
        committed to protecting your personal information.
      </p>

      <h2>Information We Collect</h2>
      <p>
        We may collect contact details such as your name, email address, or phone
        number when you contact us. We may also collect basic usage data to
        improve our website.
      </p>

      <h2>How We Use Information</h2>
      <p>
        Information is used to respond to inquiries, provide services, improve
        our website, and communicate with you when requested.
      </p>

      <h2>Sharing of Information</h2>
      <p>
        We do not sell or rent your personal information. Information may only be
        shared when required by law or to provide requested services.
      </p>

      <h2>Cookies</h2>
      <p>
        Our website may use cookies to improve functionality and understand site
        traffic. You may disable cookies in your browser settings.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Contact us at{" "}
        <a
          href="mailto:thriftbarnfurniture@gmail.com"
          className={styles.link}
        >
          thriftbarnfurniture@gmail.com
        </a>
      </p>
    </main>
  );
}
