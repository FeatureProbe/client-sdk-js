/**
 * You can obtainan a client of FPUser, 
 * which provides all of the FPUser's functionality.
 */
export class FPUser {
  private key: string;
  private attrs: { [key: string]: string };

  constructor(key?: string) {
    this.key = String(key || Date.now());
    this.attrs = {};
  }

  /**
   * Upload attributes to the FPUser client.
   * 
   * @param attrName
   *   The attribute key.
   * @param attrValue
   *   The attribute value.
   * 
   */
  public with(attrName: string, attrValue: string): FPUser {
    this.attrs[attrName] = attrValue;
    return this;
  }

  /**
   * Get the unique key of the FPUser client.
   */
  public getKey(): string {
    return this.key;
  }

  /**
   * Get all attributes of the FPUser client.
   * 
   * @param key
   *   The uqique FPUser key.
   * 
   */
  public getAttrs(): { [key: string]: string } {
    return Object.assign({}, this.attrs);
  }

  /**
   * Extend several attributes of the FPUser client.
   * 
   * @param attrs
   *   key-value pairs.
   * 
   */
  public extendAttrs(attrs: { [key: string]: string }): FPUser {
    for (const key in attrs) {
      this.attrs[key] = attrs[key];
    }
    return this;
  }

  /**
   * Get attribute value of a specified attribute key.
   * 
   * @param attrName
   *   The attribute key.
   * 
   */
  public get(attrName: string): string | undefined {
    return this.attrs[attrName];
  }

  /**
   * Change a stable key for the FPUser client.
   * 
   * @param key
   *   The uqique FPUser key.
   * 
   */
  public stableRollout(key: string): FPUser {
    this.key = key;
    return this;
  }
}
