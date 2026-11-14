"""SSH 远程执行辅助：python scripts/ssh-run.py "命令" [--put 本地路径 远程路径]"""
import sys

import paramiko

HOST, USER, PW = "192.168.65.101", "root", "123456"


def client() -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PW, timeout=15)
    return c


def main() -> None:
    args = sys.argv[1:]
    c = client()
    try:
        if args and args[0] == "--put":
            with c.open_sftp() as sftp:
                sftp.put(args[1], args[2])
            print(f"uploaded {args[1]} -> {args[2]}")
        else:
            cmd = args[0] if args else "hostname"
            _, out, err = c.exec_command(cmd, timeout=600)
            code = out.channel.recv_exit_status()
            sys.stdout.write(out.read().decode("utf-8", "replace"))
            e = err.read().decode("utf-8", "replace")
            if e:
                sys.stdout.write("[stderr] " + e)
            sys.exit(code)
    finally:
        c.close()


if __name__ == "__main__":
    main()
