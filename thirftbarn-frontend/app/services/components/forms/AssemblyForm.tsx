// app/services/components/forms/AssemblyForm.tsx
"use client";

import { useState } from "react";
import type { IndoorOutdoor, ServiceId, YesNo } from "../../services";
import { INDOOR_OUTDOOR_OPTIONS, YES_NO_OPTIONS } from "../../services";
import {
  Field,
  Input,
  RadioGroup,
  Row,
  Section,
  Textarea,
  HelpPill,
} from "../shared";

export default function AssemblyForm({ serviceId }: { serviceId: ServiceId }) {
  const [indoorOutdoor, setIndoorOutdoor] = useState<IndoorOutdoor>("indoor");
  const [itemInPlace, setItemInPlace] = useState<YesNo>("no");

  return (
    <>
      <input type="hidden" name="service_kind" value="furniture_assembly" />

      <Section
        title="Assembly location"
        description="Where the assembly will take place."
      >
        <Field label="Site address" required>
          <Input
            name="assembly_address"
            placeholder="Street, City, Postal Code"
            required
            autoComplete="street-address"
          />
        </Field>
      </Section>

      <Section
        title="Build details"
        description="Tell us what you need built and any constraints."
      >
        <Row>
          <Field
            label="Indoor or outdoor build?"
            hint="Where will the assembled item live?"
          >
            <RadioGroup<IndoorOutdoor>
              name="assembly_indoor_outdoor"
              options={INDOOR_OUTDOOR_OPTIONS}
              value={indoorOutdoor}
              onChange={setIndoorOutdoor}
            />
            <input
              type="hidden"
              name="assembly_indoor_outdoor"
              value={indoorOutdoor}
            />
          </Field>

          <Field
            label="Boxes / item already in place?"
            hint="Is everything ready at the build location?"
          >
            <RadioGroup<YesNo>
              name="assembly_item_in_place"
              options={YES_NO_OPTIONS}
              value={itemInPlace}
              onChange={setItemInPlace}
            />
            <input
              type="hidden"
              name="assembly_item_in_place"
              value={itemInPlace}
            />
          </Field>
        </Row>

        <Field
          label="Product link (optional)"
          hint="If it’s an IKEA/online product, paste the link here."
        >
          <Input
            name="assembly_product_link"
            placeholder="https://..."
            inputMode="url"
          />
        </Field>

        <Field
          label="Build requirement"
          hint="Briefly describe what needs to be assembled."
          required
        >
          <Textarea
            name="assembly_description"
            placeholder="Example: 2 dressers + 1 bed frame, need to be assembled in the bedroom. Tight hallway, please bring compact tools."
            required
          />
        </Field>

        <Field
          label="Upload photos (optional)"
          hint="Photos can help us confirm parts, space, and complexity."
        >
          <Input type="file" name="photos" accept="image/*" multiple />
        </Field>
      </Section>

      <Section
        title="Contact info"
        description="We’ll use this to reach out and to send your confirmation email."
      >
        <Row>
          <Field label="Full name" required>
            <Input name="contact_name" placeholder="Your name" required />
          </Field>

          <Field label="Phone number" required>
            <Input
              name="contact_phone"
              placeholder="(###) ###-####"
              required
              autoComplete="tel"
            />
          </Field>
        </Row>

        <Field label="Email" required>
          <Input
            name="contact_email"
            type="email"
            placeholder="you@email.com"
            required
            autoComplete="email"
          />
        </Field>
      </Section>
    </>
  );
}
