package main

import (
	"flag"
	"log"
	"net"
	"os"
	"time"

	"github.com/pion/turn/v4"
)

func main() {
	role := flag.String("role", "sender", "Role: sender or receiver")
	turnServer := flag.String("turn", "pingo-server:3478", "TURN server address")
	user := flag.String("user", "pingo", "TURN user")
	pass := flag.String("pass", "pingosecret", "TURN pass")
	flag.Parse()

	log.Printf("🚀 Starting Docker Isolated Peer [%s] connecting to TURN: %s", *role, *turnServer)

	// Listen on local UDP socket inside container
	localConn, err := net.ListenPacket("udp4", "0.0.0.0:0")
	if err != nil {
		log.Fatalf("Failed to create local UDP socket: %v", err)
	}
	defer localConn.Close()

	// Connect to TURN server
	client, err := turn.NewClient(&turn.ClientConfig{
		TURNServerAddr: *turnServer,
		Conn:           localConn,
		Username:       *user,
		Password:       *pass,
		Realm:          "pingo",
	})
	if err != nil {
		log.Fatalf("Failed to initialize TURN client: %v", err)
	}
	defer client.Close()

	if err := client.Listen(); err != nil {
		log.Fatalf("Failed to start TURN client listener: %v", err)
	}

	relayConn, err := client.Allocate()
	if err != nil {
		log.Fatalf("TURN Allocation failed: %v", err)
	}
	defer relayConn.Close()

	relayedAddr := relayConn.LocalAddr().(*net.UDPAddr)
	log.Printf("✅ Relayed Address Allocated on TURN: %s", relayedAddr.String())

	myFile := fmtAddrFile(*role)
	peerFile := fmtAddrFile(otherRole(*role))

	os.WriteFile(myFile, []byte(relayedAddr.String()), 0644)
	log.Printf("📝 Published my relay address to %s: %s", myFile, relayedAddr.String())

	// Wait for peer's relay address
	var peerAddr *net.UDPAddr
	for i := 0; i < 25; i++ {
		if data, err := os.ReadFile(peerFile); err == nil && len(data) > 0 {
			addrStr := string(data)
			if addr, err := net.ResolveUDPAddr("udp4", addrStr); err == nil {
				peerAddr = addr
				break
			}
		}
		log.Printf("⏳ [%s] Waiting for peer (%s) to publish relay address...", *role, otherRole(*role))
		time.Sleep(1 * time.Second)
	}

	if peerAddr == nil {
		log.Fatalf("❌ [%s] Timeout waiting for peer relay address", *role)
	}

	log.Printf("🎯 [%s] Discovered Peer Relay Address: %s", *role, peerAddr.String())

	// Create TURN permission for peer relay address
	if err := client.CreatePermission(peerAddr); err != nil {
		log.Fatalf("❌ [%s] Failed to create permission for %s: %v", *role, peerAddr.String(), err)
	}
	log.Printf("🔐 [%s] Created TURN permission for %s", *role, peerAddr.String())

	if *role == "receiver" {
		log.Println("📥 [RECEIVER] Listening for packets from Sender via TURN relay...")
		buf := make([]byte, 2048)
		relayConn.SetReadDeadline(time.Now().Add(25 * time.Second))
		n, from, err := relayConn.ReadFrom(buf)
		if err != nil {
			log.Fatalf("❌ [RECEIVER] Error reading from relay: %v", err)
		}

		receivedMsg := string(buf[:n])
		log.Printf("🎉 [RECEIVER SUCCESS] Got message '%s' from %s", receivedMsg, from.String())

		// Reply
		replyMsg := "PINGO_DOCKER_PONG_CONFIRMED"
		for i := 0; i < 5; i++ {
			relayConn.WriteTo([]byte(replyMsg), peerAddr)
			time.Sleep(200 * time.Millisecond)
		}
		log.Println("📤 [RECEIVER] Sent reply to Sender via TURN relay!")
		time.Sleep(5 * time.Second)
		os.Exit(0)
	} else {
		// Sender
		log.Println("📤 [SENDER] Sending packets to Receiver via TURN relay...")
		msg := "PINGO_DOCKER_PING_HELLO_ACROSS_NETWORKS"
		for attempt := 1; attempt <= 10; attempt++ {
			_, err = relayConn.WriteTo([]byte(msg), peerAddr)
			if err != nil {
				log.Printf("⚠️ Write attempt %d error: %v", attempt, err)
			} else {
				log.Printf("📤 Sent attempt %d...", attempt)
			}
			time.Sleep(500 * time.Millisecond)
		}

		buf := make([]byte, 2048)
		relayConn.SetReadDeadline(time.Now().Add(15 * time.Second))
		n, from, err := relayConn.ReadFrom(buf)
		if err != nil {
			log.Fatalf("❌ [SENDER] Timed out waiting for reply: %v", err)
		}

		reply := string(buf[:n])
		log.Printf("🎉 [SENDER SUCCESS] Received reply: '%s' from %s", reply, from.String())
		log.Println("🏆 PRUEBA 4 SUPERADA: CONEXION BIDIRECCIONAL COMPLETA ENTRE SUBREDES AISLADAS!")
		os.Exit(0)
	}
}

func otherRole(r string) string {
	if r == "sender" {
		return "receiver"
	}
	return "sender"
}

func fmtAddrFile(r string) string {
	return "/tmp/" + r + "_relay.addr"
}
