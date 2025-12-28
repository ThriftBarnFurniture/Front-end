import styles from "./terms.module.css";

export default function TermsPage() {
  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Terms & Conditions</h1>
      <p className={styles.updated}>Last updated: December 2025</p>

      <p>
        By accessing or using the Thrift Barn Furniture website or services, you
        agree to the following terms.
      </p>

      <h2>Use of Website</h2>
      <p>
        This website is provided for informational purposes only. You agree not
        to use it for unlawful activities.
      </p>

      <h2>Products & Services</h2>
      <p>
        All products are sold as-is unless otherwise stated. Availability and
        pricing may change without notice.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        Thrift Barn Furniture is not responsible for damages arising from use of
        the website or services, except where required by law.
      </p>

      <h2>Governing Law</h2>
      <p>
        These terms are governed by the laws of Ontario, Canada.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Contact{" "}
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
