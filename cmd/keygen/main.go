// dev-only: generate a serial number for a given HWID
package main

import (
	"flag"
	"fmt"
	"os"

	"auto-clipper/internal/license"
)

func main() {
	salt := flag.String("salt", "", "License salt from config.yaml")
	hwid := flag.String("hwid", "", "Target hardware HWID (leave empty to use current machine)")
	flag.Parse()

	if *salt == "" {
		fmt.Fprintln(os.Stderr, "Usage: keygen -salt <salt> [-hwid <hwid>]")
		os.Exit(1)
	}

	targetHWID := *hwid
	if targetHWID == "" {
		var err error
		targetHWID, err = license.GetHWID()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to get HWID: %v\n", err)
			os.Exit(1)
		}
	}

	serial := license.GenerateSerial(targetHWID, *salt)
	fmt.Printf("HWID:   %s\n", targetHWID)
	fmt.Printf("Serial: %s\n", serial)
}
